import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Regression contract for lock-conflict retries on DuckDB reads.
 *
 * Why this exists: the workspace stores its objects in a single
 * `workspace.duckdb` file accessed via the DuckDB CLI. Each CLI invocation
 * grabs an exclusive file lock, so back-to-back operations can collide
 * (server-side write + the immediate client GET that follows is the canonical
 * trigger). Before this contract was locked in, read failures from a lock
 * conflict were caught and silently turned into `[]`. The route handler then
 * couldn't distinguish "no rows" from "couldn't read" and returned 404, the
 * frontend right panel went blank, and the user saw a "crash" right after
 * creating a column.
 *
 * The contract: read helpers must retry lock-conflict failures with the same
 * exponential backoff that write helpers (`duckdbExecOnFileAsync`) already
 * use, and only surface `[]` / throw after the retries are exhausted.
 *
 * The tests deliberately hit the public API (`duckdbQueryOnFileAsync`,
 * `duckdbQueryOnFileAsyncStrict`) rather than the private retry helper, so
 * future refactors that move the retry logic around are still covered.
 */

// vi.mock factories are hoisted above all other code in the file. To share
// the same mock fn between the factory and the test bodies we declare it
// via vi.hoisted, which runs before the mock factory.
const { execFileMock, spawnMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
  spawnMock: vi.fn(() => ({
    on: vi.fn(),
    stdin: { write: vi.fn(), end: vi.fn(), on: vi.fn() },
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
  })),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn((p: string) => p === "/opt/homebrew/bin/duckdb"),
  readFileSync: vi.fn(() => ""),
  readdirSync: vi.fn(() => []),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  access: vi.fn(async () => {
    throw new Error("ENOENT");
  }),
  readdir: vi.fn(async () => []),
}));

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
  execFileSync: vi.fn(() => ""),
  execSync: vi.fn(() => ""),
  exec: vi.fn(),
  spawn: spawnMock,
}));

vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/home/testuser"),
}));

import { duckdbQueryOnFileAsync, duckdbQueryOnFileAsyncStrict } from "./workspace";

type ExecFileCb = (
  err: NodeJS.ErrnoException | null,
  result: { stdout: string; stderr: string } | null,
) => void;

/** Build a lock-conflict error in the shape `execFile`'s error callback uses. */
function lockConflictError(): NodeJS.ErrnoException {
  const err = new Error("Command failed") as NodeJS.ErrnoException & {
    stderr: string;
  };
  err.stderr =
    'Error: unable to open database "/tmp/test.duckdb": IO Error: Could not set lock on file "/tmp/test.duckdb": Conflicting lock is held in /opt/homebrew/bin/duckdb (PID 12345) by user testuser.';
  return err;
}

function syntaxError(): NodeJS.ErrnoException {
  const err = new Error("Command failed") as NodeJS.ErrnoException & {
    stderr: string;
  };
  err.stderr = "Parser Error: syntax error at or near \"FROOM\"";
  return err;
}

beforeEach(() => {
  execFileMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("duckdbQueryOnFileAsync — lock-conflict retry", () => {
  it("returns rows on first success without retrying", async () => {
    execFileMock.mockImplementationOnce(
      (_bin: string, _args: string[], _opts: unknown, cb: ExecFileCb) => {
        cb(null, { stdout: '[{"id":"obj1","name":"company"}]', stderr: "" });
      },
    );

    const rows = await duckdbQueryOnFileAsync<{ id: string; name: string }>(
      "/tmp/test.duckdb",
      "SELECT * FROM objects",
    );

    expect(rows).toEqual([{ id: "obj1", name: "company" }]);
    expect(execFileMock).toHaveBeenCalledTimes(1);
  });

  it(
    "REGRESSION: retries on a Conflicting-lock error and returns the rows from the next attempt " +
      "(prevents the silent [] → 404 → blank-panel 'crash' after column creation)",
    async () => {
      // First attempt: lock conflict. Second attempt: rows.
      execFileMock
        .mockImplementationOnce(
          (_bin: string, _args: string[], _opts: unknown, cb: ExecFileCb) => {
            cb(lockConflictError(), null);
          },
        )
        .mockImplementationOnce(
          (_bin: string, _args: string[], _opts: unknown, cb: ExecFileCb) => {
            cb(null, { stdout: '[{"id":"obj1","name":"company"}]', stderr: "" });
          },
        );

      const rows = await duckdbQueryOnFileAsync<{ id: string; name: string }>(
        "/tmp/test.duckdb",
        "SELECT * FROM objects WHERE name = 'company'",
      );

      expect(rows).toEqual([{ id: "obj1", name: "company" }]);
      expect(execFileMock).toHaveBeenCalledTimes(2);
    },
    8000,
  );

  it("does NOT retry non-lock errors (parser errors, missing tables, etc — fail fast)", async () => {
    execFileMock.mockImplementationOnce(
      (_bin: string, _args: string[], _opts: unknown, cb: ExecFileCb) => {
        cb(syntaxError(), null);
      },
    );

    const rows = await duckdbQueryOnFileAsync(
      "/tmp/test.duckdb",
      "SELECT * FROOM objects",
    );

    expect(rows).toEqual([]);
    expect(execFileMock).toHaveBeenCalledTimes(1);
  });

  it("returns [] without retrying when the read genuinely produces no rows", async () => {
    execFileMock.mockImplementationOnce(
      (_bin: string, _args: string[], _opts: unknown, cb: ExecFileCb) => {
        cb(null, { stdout: "[]", stderr: "" });
      },
    );

    const rows = await duckdbQueryOnFileAsync("/tmp/test.duckdb", "SELECT 1 WHERE FALSE");

    expect(rows).toEqual([]);
    expect(execFileMock).toHaveBeenCalledTimes(1);
  });
});

describe("duckdbQueryOnFileAsyncStrict — lock-conflict retry", () => {
  it("returns rows on first success without retrying", async () => {
    execFileMock.mockImplementationOnce(
      (_bin: string, _args: string[], _opts: unknown, cb: ExecFileCb) => {
        cb(null, { stdout: '[{"cnt":42}]', stderr: "" });
      },
    );

    const rows = await duckdbQueryOnFileAsyncStrict<{ cnt: number }>(
      "/tmp/test.duckdb",
      'SELECT COUNT(*) AS cnt FROM "v_company"',
    );

    expect(rows).toEqual([{ cnt: 42 }]);
    expect(execFileMock).toHaveBeenCalledTimes(1);
  });

  it(
    "REGRESSION: retries on a Conflicting-lock error before resolving with rows " +
      "(strict variant must not throw spuriously when the failure was just a transient lock race)",
    async () => {
      execFileMock
        .mockImplementationOnce(
          (_bin: string, _args: string[], _opts: unknown, cb: ExecFileCb) => {
            cb(lockConflictError(), null);
          },
        )
        .mockImplementationOnce(
          (_bin: string, _args: string[], _opts: unknown, cb: ExecFileCb) => {
            cb(null, { stdout: '[{"cnt":42}]', stderr: "" });
          },
        );

      const rows = await duckdbQueryOnFileAsyncStrict<{ cnt: number }>(
        "/tmp/test.duckdb",
        'SELECT COUNT(*) AS cnt FROM "v_company"',
      );

      expect(rows).toEqual([{ cnt: 42 }]);
      expect(execFileMock).toHaveBeenCalledTimes(2);
    },
    8000,
  );

  it("rethrows immediately on non-lock errors (so callers can fall back, e.g. EAV when pivot view is missing)", async () => {
    execFileMock.mockImplementationOnce(
      (_bin: string, _args: string[], _opts: unknown, cb: ExecFileCb) => {
        const err = new Error("Catalog Error: Table with name v_company does not exist!") as
          NodeJS.ErrnoException & { stderr: string };
        err.stderr = "Catalog Error: Table with name v_company does not exist!";
        cb(err, null);
      },
    );

    await expect(
      duckdbQueryOnFileAsyncStrict("/tmp/test.duckdb", 'SELECT * FROM "v_company"'),
    ).rejects.toThrow();
    expect(execFileMock).toHaveBeenCalledTimes(1);
  });
});
