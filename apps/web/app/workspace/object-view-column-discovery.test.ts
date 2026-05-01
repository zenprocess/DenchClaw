import { describe, expect, it } from "vitest";
import {
  type FieldIdentifier,
  mergeNewlySeenColumns,
} from "./object-view-column-discovery";

/**
 * Replica of the `columnVisibility` useMemo body in
 * `workspace-content.tsx`. Kept here so this test file owns the contract
 * end-to-end: "given a `viewColumns` whitelist and a list of fields, the
 * result of `computeColumnVisibility(...)` must show every newly-seen
 * field after `mergeNewlySeenColumns(...)` has been applied."
 *
 * If `workspace-content.tsx`'s real memo diverges from this replica, the
 * integration test below stops being meaningful — but the unit tests on
 * `mergeNewlySeenColumns` itself still hold.
 */
function computeColumnVisibility(
  viewColumns: string[] | undefined,
  fields: readonly FieldIdentifier[],
): Record<string, boolean> | undefined {
  const vis: Record<string, boolean> = {};
  if (viewColumns && viewColumns.length > 0) {
    for (const field of fields) {
      vis[field.id] = viewColumns.includes(field.name);
    }
  }
  return Object.keys(vis).length === 0 ? undefined : vis;
}

describe("mergeNewlySeenColumns", () => {
  it("first call records the seen field IDs without modifying viewColumns", () => {
    const fields: FieldIdentifier[] = [
      { id: "f_name", name: "Name" },
      { id: "f_email", name: "Email" },
    ];
    const viewColumns = ["Name", "Email"];

    const result = mergeNewlySeenColumns(viewColumns, null, fields);

    expect(result.nextViewColumns).toBe(viewColumns);
    expect(result.nextSeen).toEqual(new Set(["f_name", "f_email"]));
  });

  it("appends a newly-appeared field's name to a non-empty viewColumns whitelist", () => {
    const initialFields: FieldIdentifier[] = [
      { id: "f_name", name: "Name" },
      { id: "f_email", name: "Email" },
    ];
    const viewColumns = ["Name", "Email"];

    const init = mergeNewlySeenColumns(viewColumns, null, initialFields);

    const updatedFields: FieldIdentifier[] = [
      ...initialFields,
      { id: "f_notes", name: "Notes" },
    ];
    const next = mergeNewlySeenColumns(
      init.nextViewColumns,
      init.nextSeen,
      updatedFields,
    );

    expect(next.nextViewColumns).toEqual(["Name", "Email", "Notes"]);
    expect(next.nextSeen).toEqual(new Set(["f_name", "f_email", "f_notes"]));
  });

  it("does not modify viewColumns when it is undefined (no whitelist active → everything already visible)", () => {
    const initial = mergeNewlySeenColumns(undefined, null, [
      { id: "f_name", name: "Name" },
    ]);

    const next = mergeNewlySeenColumns(undefined, initial.nextSeen, [
      { id: "f_name", name: "Name" },
      { id: "f_notes", name: "Notes" },
    ]);

    expect(next.nextViewColumns).toBeUndefined();
  });

  it("preserves reference equality of viewColumns when nothing new appeared", () => {
    const viewColumns = ["Name"];
    const init = mergeNewlySeenColumns(viewColumns, null, [
      { id: "f_name", name: "Name" },
    ]);
    const next = mergeNewlySeenColumns(init.nextViewColumns, init.nextSeen, [
      { id: "f_name", name: "Name" },
    ]);

    expect(next.nextViewColumns).toBe(viewColumns);
  });

  it("does not double-add a name already present in viewColumns (e.g. delete-then-recreate with different ID, same name)", () => {
    // First mount: original "Notes" field with id f_notes_v1 is visible.
    const initialFields: FieldIdentifier[] = [
      { id: "f_notes_v1", name: "Notes" },
    ];
    const init = mergeNewlySeenColumns(["Notes"], null, initialFields);

    // Field is recreated with a fresh ID but same name.
    const recreatedFields: FieldIdentifier[] = [
      { id: "f_notes_v2", name: "Notes" },
    ];
    const next = mergeNewlySeenColumns(
      init.nextViewColumns,
      init.nextSeen,
      recreatedFields,
    );

    // viewColumns still has just one "Notes" entry — no duplication.
    expect(next.nextViewColumns).toEqual(["Notes"]);
    expect(next.nextSeen.has("f_notes_v2")).toBe(true);
  });

  it("treats a renamed field (same id, different name) as already-seen and does NOT merge its new name", () => {
    const init = mergeNewlySeenColumns(["Old Name"], null, [
      { id: "f_x", name: "Old Name" },
    ]);

    // The user renamed the field via the inline rename UI; the rename
    // path updates viewColumns separately. mergeNewlySeenColumns should
    // not re-add the field by its new name (would duplicate it).
    const next = mergeNewlySeenColumns(["Old Name"], init.nextSeen, [
      { id: "f_x", name: "New Name" },
    ]);

    expect(next.nextViewColumns).toEqual(["Old Name"]);
  });

  it("appends multiple new fields in the order they appear", () => {
    const init = mergeNewlySeenColumns(["A"], null, [
      { id: "f_a", name: "A" },
    ]);

    const next = mergeNewlySeenColumns(init.nextViewColumns, init.nextSeen, [
      { id: "f_a", name: "A" },
      { id: "f_b", name: "B" },
      { id: "f_c", name: "C" },
    ]);

    expect(next.nextViewColumns).toEqual(["A", "B", "C"]);
  });

  it(
    "REGRESSION: with a saved-view whitelist, a column added after mount is HIDDEN " +
      "without the merge but VISIBLE with it",
    () => {
      // Initial state: user is on a saved view with two columns explicitly
      // visible. ObjectView mounts and records what it sees.
      const initialFields: FieldIdentifier[] = [
        { id: "f_name", name: "Name" },
        { id: "f_email", name: "Email" },
      ];
      const savedViewColumns = ["Name", "Email"];
      const init = mergeNewlySeenColumns(
        savedViewColumns,
        null,
        initialFields,
      );

      // Refresh after the user creates "Notes" via the Add Column popover.
      const refreshedFields: FieldIdentifier[] = [
        ...initialFields,
        { id: "f_notes", name: "Notes" },
      ];

      // --- Without the helper (simulating the pre-fix bug): viewColumns
      // is unchanged; the new column resolves to hidden. ---
      const buggyVisibility = computeColumnVisibility(
        savedViewColumns,
        refreshedFields,
      );
      expect(buggyVisibility?.["f_notes"]).toBe(false);

      // --- With the helper: viewColumns gains "Notes"; visibility memo
      // now resolves the new column as visible. ---
      const merged = mergeNewlySeenColumns(
        init.nextViewColumns,
        init.nextSeen,
        refreshedFields,
      );
      const fixedVisibility = computeColumnVisibility(
        merged.nextViewColumns,
        refreshedFields,
      );
      expect(fixedVisibility?.["f_notes"]).toBe(true);
      // And the user's existing visibility for older fields is preserved.
      expect(fixedVisibility?.["f_name"]).toBe(true);
      expect(fixedVisibility?.["f_email"]).toBe(true);
    },
  );

  it("REGRESSION: does NOT auto-show fields the user explicitly hid before mount (preserves saved view intent)", () => {
    // User's saved view has explicitly hidden "Phone" (it exists on the
    // object but is not in the whitelist).
    const initialFields: FieldIdentifier[] = [
      { id: "f_name", name: "Name" },
      { id: "f_phone", name: "Phone" },
    ];
    const savedViewColumns = ["Name"]; // Phone deliberately hidden

    const init = mergeNewlySeenColumns(
      savedViewColumns,
      null,
      initialFields,
    );

    // viewColumns must be untouched on initial mount — Phone stays hidden.
    expect(init.nextViewColumns).toEqual(["Name"]);
    const visibility = computeColumnVisibility(
      init.nextViewColumns,
      initialFields,
    );
    expect(visibility?.["f_phone"]).toBe(false);
  });
});
