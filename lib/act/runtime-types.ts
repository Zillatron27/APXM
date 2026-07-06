// Runtime context handed to ACT action steps so they can scope DOM queries.
//
// refined-prun's desktop PrunTile is a floating tile/window. Mobile APXM has no
// tiles: every buffer opens inside #container, so the "tile" an action step
// receives is simply an anchor element it scopes its DOM queries against.

export interface PrunTile {
  // The DOM subtree the action step scopes its queries to. On mobile APXM this
  // is always #container — the single buffer host opened by openMobileBuffer.
  anchor: HTMLElement;
}
