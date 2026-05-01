/**
 * Newly-discovered column tracking for `ObjectView`.
 *
 * Why this exists: `viewColumns` (the persisted column-visibility state) is
 * stored as a whitelist of *visible* column names. When the user creates a
 * column via the Add Column popover — or when the AI adds a field by editing
 * `.object.yaml` — the new field arrives in `data.fields` after a refresh,
 * but its name is not in `viewColumns`. The downstream visibility memo then
 * resolves `vis[newField.id] = viewColumns.includes(newField.name) === false`
 * and the new column is silently hidden, contradicting the obvious user
 * intent ("I just made this column, I want to see it").
 *
 * The fix is to detect fields that appear *after* initial mount and merge
 * their names into `viewColumns`. We can't do this on the very first render
 * because at that point everything is "new" — and applying the merge would
 * effectively force every field visible, overriding the user's saved
 * visibility for fields that already existed at load time.
 *
 * Identification is by field ID, not name, so that:
 *  - A field renamed in place (same ID, new name) is *not* treated as new.
 *  - A field deleted and recreated with the same name (new ID) *is* treated
 *    as new and made visible.
 */
export type FieldIdentifier = { id: string; name: string };

export type ColumnDiscoveryResult = {
  /**
   * The merged `viewColumns` to commit. Returned unchanged when no merging
   * is required. Reference equality is preserved so callers can skip a
   * `setViewColumns` call (and the resulting render + URL push).
   */
  nextViewColumns: string[] | undefined;
  /** The Set to store back into the tracking ref for the next call. */
  nextSeen: Set<string>;
};

/**
 * Decide what to do with `viewColumns` given the previous set of known
 * field IDs and the current `data.fields`.
 *
 * - First call (`prevSeen === null`): record the current field IDs and
 *   return `viewColumns` unchanged. Initial-mount fields use whatever
 *   visibility they would have under the existing `viewColumns`.
 * - Subsequent calls: any field ID not in `prevSeen` is "new". If
 *   `viewColumns` is unset / empty (i.e. no whitelist active), no merge is
 *   needed because the visibility memo will already show every column.
 *   Otherwise, append the new field names that are not already present.
 */
export function mergeNewlySeenColumns(
  viewColumns: string[] | undefined,
  prevSeen: Set<string> | null,
  currentFields: readonly FieldIdentifier[],
): ColumnDiscoveryResult {
  if (prevSeen === null) {
    const nextSeen = new Set<string>();
    for (const field of currentFields) {
      nextSeen.add(field.id);
    }
    return { nextViewColumns: viewColumns, nextSeen };
  }

  const nextSeen = new Set(prevSeen);
  const newlyAppearedNames: string[] = [];
  for (const field of currentFields) {
    if (nextSeen.has(field.id)) continue;
    nextSeen.add(field.id);
    newlyAppearedNames.push(field.name);
  }

  if (newlyAppearedNames.length === 0) {
    return { nextViewColumns: viewColumns, nextSeen };
  }

  // No active whitelist → visibility memo already shows everything; nothing
  // to merge into.
  if (!viewColumns || viewColumns.length === 0) {
    return { nextViewColumns: viewColumns, nextSeen };
  }

  const present = new Set(viewColumns);
  const additions: string[] = [];
  for (const name of newlyAppearedNames) {
    if (present.has(name)) continue;
    present.add(name);
    additions.push(name);
  }

  if (additions.length === 0) {
    return { nextViewColumns: viewColumns, nextSeen };
  }

  return { nextViewColumns: [...viewColumns, ...additions], nextSeen };
}
