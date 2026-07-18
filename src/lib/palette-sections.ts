// Section identity and Tab-stop boundaries for the palette's selectable
// list. Shared by TreeView (section headers) and CommandBar (Tab/Shift+Tab
// section jumping) so headers and Tab stops can never drift apart.

/** The minimal item shape both TreeView and CommandBar rows satisfy. */
export interface SectionableItem {
  type: string;
  depth?: number;
}

/** Maps an item type to the section header it renders under. */
export function sectionOf(item: SectionableItem): string | null {
  switch (item.type) {
    case 'tab':
    case 'group':
      return 'Open Tabs';
    case 'bookmark':
    case 'folder':
      return 'Bookmarks';
    case 'history':
      return 'History';
    case 'action':
      return 'Actions';
    case 'goto':
      return 'Navigate';
    default:
      return null;
  }
}

/**
 * Flat indices where a Tab stop begins. A boundary exists where the section
 * changes versus the previous item (the type-run starts of search/action
 * results), and additionally at every top-level folder/group row — in the
 * jump-mode tree everything maps to one 'Bookmarks' section, so root
 * folders are the groups Tab hops between. The folder/group restriction
 * matters: tabs and history rows are depth 0 too, and treating them as
 * boundaries would degrade Tab back into ArrowDown.
 */
export function computeSectionBoundaries(items: SectionableItem[]): number[] {
  const boundaries: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const sectionChanged = i === 0 || sectionOf(item) !== sectionOf(items[i - 1]);
    const isTopLevelGroup =
      item.depth === 0 && (item.type === 'folder' || item.type === 'group');
    if (sectionChanged || isTopLevelGroup) boundaries.push(i);
  }
  return boundaries;
}

/**
 * The next Tab stop from selectedIndex, or null when there is nothing to
 * jump between — fewer than two sections. Callers fall back to item
 * stepping then, so Tab keeps moving the selection in single-section lists
 * ('>' action mode) instead of no-oping or yanking it back to the top.
 *
 * Forward: first boundary after the selection, wrapping to the first.
 * Backward: the PREVIOUS section's start, even from mid-section (matching
 * TS-063 and the onboarding "Jump to previous group" copy), wrapping to
 * the last section from the first.
 */
export function stepSectionBoundary(
  boundaries: number[],
  selectedIndex: number,
  dir: 1 | -1
): number | null {
  if (boundaries.length < 2) return null;
  if (dir === 1) {
    const next = boundaries.find((b) => b > selectedIndex);
    return next ?? boundaries[0];
  }
  // Start of the section the selection is currently in (or the first
  // boundary when the selection sits above every boundary).
  const currentStart =
    [...boundaries].reverse().find((b) => b <= selectedIndex) ?? boundaries[0];
  const prev = [...boundaries].reverse().find((b) => b < currentStart);
  return prev ?? boundaries[boundaries.length - 1];
}
