const ACTION_KEYS = new Set('c x p m d w r t u z q s ,'.split(' '));
// Numbers reserved for pinned tabs — not in dynamic pool
const LABEL_POOL = 'a b e f g h i j k l n o v y'.split(' ');

export interface LabelAssignment {
  index: number;
  label: string;
}

export function assignLabels(visibleCount: number): LabelAssignment[] {
  const assignments: LabelAssignment[] = [];

  if (visibleCount <= LABEL_POOL.length) {
    for (let i = 0; i < visibleCount; i++) {
      assignments.push({ index: i, label: LABEL_POOL[i] });
    }
  } else {
    // First batch: single-char labels
    for (let i = 0; i < LABEL_POOL.length && i < visibleCount; i++) {
      assignments.push({ index: i, label: LABEL_POOL[i] });
    }
    // Remaining: two-char combos
    let idx = LABEL_POOL.length;
    outer:
    for (const first of LABEL_POOL) {
      for (const second of LABEL_POOL) {
        if (idx >= visibleCount) break outer;
        assignments.push({ index: idx, label: first + second });
        idx++;
      }
    }
  }

  return assignments;
}

export function isActionKey(key: string): boolean {
  return ACTION_KEYS.has(key);
}

export function isDynamicLabelKey(key: string): boolean {
  return LABEL_POOL.includes(key) && !ACTION_KEYS.has(key);
}

export function getActionForKey(key: string): string | null {
  const ACTION_MAP: Record<string, string> = {
    'c': 'close-tab',
    'x': 'close-other-tabs',
    'p': 'pin-tab',
    'm': 'mute-tab',
    'd': 'duplicate-tab',
    'w': 'move-to-window',
    'r': 'reload-tab',
    't': 'new-tab',
    'u': 'go-to-url',
    'z': 'recently-closed',
    'q': 'close-duplicates',
    's': 'sort-by-domain',
    ',': 'settings',
  };
  return ACTION_MAP[key] || null;
}

export { ACTION_KEYS, LABEL_POOL };
