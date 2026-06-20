"use client";

import { useCallback, useEffect, useState } from "react";

type Role = "admin" | "member" | "viewer";

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  workspaceName: string;
  active: boolean;
  createdAt: string;
};

const ROLES: Role[] = ["admin", "member", "viewer"];

export function UsersClient({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ name: string; email: string; role: Role }>({
    name: "",
    email: "",
    role: "member",
  });
  const [tempPassword, setTempPassword] = useState<{ email: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = (await res.json()) as { users?: ManagedUser[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load users");
      setUsers(data.users ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createUser(event: { preventDefault: () => void }) {
    event.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(invite),
      });
      const data = (await res.json()) as { temporaryPassword?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to create user");
      if (data.temporaryPassword) {
        setTempPassword({ email: invite.email, password: data.temporaryPassword });
      }
      setInvite({ name: "", email: "", role: "member" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function patchUser(id: string, patch: { role?: Role; active?: boolean }) {
    setBusy(true);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Update failed");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 text-sm">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">User management</h1>
        <p className="text-neutral-400">Invite teammates and manage roles. Each user gets an isolated workspace.</p>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300">{error}</div>
      ) : null}

      {tempPassword ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
          <div className="font-medium text-emerald-300">User created — share this one-time password</div>
          <div className="mt-1 text-neutral-300">
            {tempPassword.email}: <code className="rounded bg-black/40 px-1.5 py-0.5">{tempPassword.password}</code>
          </div>
          <button className="mt-2 text-xs text-neutral-400 underline" onClick={() => setTempPassword(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <form onSubmit={createUser} className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-700 px-4 py-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400">Name</span>
          <input
            className="rounded-lg border border-neutral-700 bg-transparent px-3 py-1.5"
            value={invite.name}
            onChange={(e) => setInvite({ ...invite, name: e.target.value })}
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400">Email</span>
          <input
            type="email"
            className="rounded-lg border border-neutral-700 bg-transparent px-3 py-1.5"
            value={invite.email}
            onChange={(e) => setInvite({ ...invite, email: e.target.value })}
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400">Role</span>
          <select
            className="rounded-lg border border-neutral-700 bg-transparent px-3 py-1.5"
            value={invite.role}
            onChange={(e) => setInvite({ ...invite, role: e.target.value as Role })}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-emerald-500 px-4 py-1.5 font-medium text-emerald-950 disabled:opacity-50"
        >
          Invite
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-neutral-700">
        <table className="w-full">
          <thead className="bg-neutral-900/60 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Workspace</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-3 text-neutral-500" colSpan={5}>
                  Loading…
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id} className="border-t border-neutral-800">
                    <td className="px-4 py-2">{u.name}</td>
                    <td className="px-4 py-2 text-neutral-400">{u.email}</td>
                    <td className="px-4 py-2 text-neutral-400">{u.workspaceName}</td>
                    <td className="px-4 py-2">
                      <select
                        className="rounded border border-neutral-700 bg-transparent px-2 py-1"
                        value={u.role}
                        disabled={busy || isSelf}
                        onChange={(e) => patchUser(u.id, { role: e.target.value as Role })}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      {u.active ? (
                        <button
                          className="text-xs text-red-400 underline disabled:opacity-40"
                          disabled={busy || isSelf}
                          onClick={() => patchUser(u.id, { active: false })}
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          className="text-xs text-emerald-400 underline disabled:opacity-40"
                          disabled={busy}
                          onClick={() => patchUser(u.id, { active: true })}
                        >
                          Reactivate
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
