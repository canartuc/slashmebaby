import { describe, it, expect } from 'vitest';
import {
  assignLabels,
  isActionKey,
  isDynamicLabelKey,
  getActionForKey,
  LABEL_POOL,
  ACTION_KEYS,
} from '../../lib/labels';

describe('assignLabels', () => {
  it('returns empty array for 0 items', () => {
    expect(assignLabels(0)).toEqual([]);
  });

  it('returns 5 single-char labels for 5 items (a,b,e,f,g)', () => {
    const result = assignLabels(5);
    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({ index: 0, label: 'a' });
    expect(result[1]).toEqual({ index: 1, label: 'b' });
    expect(result[2]).toEqual({ index: 2, label: 'e' });
    expect(result[3]).toEqual({ index: 3, label: 'f' });
    expect(result[4]).toEqual({ index: 4, label: 'g' });
  });

  it('returns exactly 14 single-char labels for 14 items', () => {
    const result = assignLabels(14);
    expect(result).toHaveLength(14);
    // All labels should be single-char
    result.forEach(({ label }) => {
      expect(label).toHaveLength(1);
    });
    // Labels should match LABEL_POOL exactly
    result.forEach(({ index, label }) => {
      expect(label).toBe(LABEL_POOL[index]);
    });
  });

  it('returns 14 single-char + 1 two-char for 15 items', () => {
    const result = assignLabels(15);
    expect(result).toHaveLength(15);
    // First 14 single-char
    for (let i = 0; i < 14; i++) {
      expect(result[i].label).toHaveLength(1);
      expect(result[i].label).toBe(LABEL_POOL[i]);
    }
    // 15th item is a two-char label: 'aa'
    expect(result[14]).toEqual({ index: 14, label: 'aa' });
  });

  it('returns correct labels for 30 items (mixed single and two-char)', () => {
    const result = assignLabels(30);
    expect(result).toHaveLength(30);
    // First 14 single-char
    for (let i = 0; i < 14; i++) {
      expect(result[i].label).toHaveLength(1);
    }
    // Remaining 16 two-char
    for (let i = 14; i < 30; i++) {
      expect(result[i].label).toHaveLength(2);
    }
  });

  it('two-char labels start with first letter of LABEL_POOL', () => {
    const result = assignLabels(30);
    // Item at index 14 = 'aa', index 15 = 'ab', index 16 = 'ae', ...
    expect(result[14].label).toBe('aa');
    expect(result[15].label).toBe('ab');
    expect(result[16].label).toBe('ae');
  });

  it('all indices are sequential starting from 0', () => {
    const result = assignLabels(10);
    result.forEach(({ index }, i) => {
      expect(index).toBe(i);
    });
  });
});

describe('isActionKey', () => {
  it('returns true for "c" (close-tab)', () => {
    expect(isActionKey('c')).toBe(true);
  });

  it('returns true for "x" (close-other-tabs)', () => {
    expect(isActionKey('x')).toBe(true);
  });

  it('returns true for "p" (pin-tab)', () => {
    expect(isActionKey('p')).toBe(true);
  });

  it('returns true for "m" (mute-tab)', () => {
    expect(isActionKey('m')).toBe(true);
  });

  it('returns true for "d" (duplicate-tab)', () => {
    expect(isActionKey('d')).toBe(true);
  });

  it('returns true for "w" (move-to-window)', () => {
    expect(isActionKey('w')).toBe(true);
  });

  it('returns true for "r" (reload-tab)', () => {
    expect(isActionKey('r')).toBe(true);
  });

  it('returns true for "t" (new-tab)', () => {
    expect(isActionKey('t')).toBe(true);
  });

  it('returns true for "u" (go-to-url)', () => {
    expect(isActionKey('u')).toBe(true);
  });

  it('returns true for "z" (recently-closed)', () => {
    expect(isActionKey('z')).toBe(true);
  });

  it('returns true for "q" (close-duplicates)', () => {
    expect(isActionKey('q')).toBe(true);
  });

  it('returns true for "s" (sort-by-domain)', () => {
    expect(isActionKey('s')).toBe(true);
  });

  it('returns true for "," (settings)', () => {
    expect(isActionKey(',')).toBe(true);
  });

  it('returns false for "a" (dynamic label key)', () => {
    expect(isActionKey('a')).toBe(false);
  });

  it('returns false for "b" (dynamic label key)', () => {
    expect(isActionKey('b')).toBe(false);
  });

  it('returns false for "e" (dynamic label key)', () => {
    expect(isActionKey('e')).toBe(false);
  });

  it('returns false for "f" (dynamic label key)', () => {
    expect(isActionKey('f')).toBe(false);
  });

  it('returns false for an unknown key', () => {
    expect(isActionKey('ArrowUp')).toBe(false);
  });

  it('contains exactly 13 action keys', () => {
    expect(ACTION_KEYS.size).toBe(13);
  });
});

describe('isDynamicLabelKey', () => {
  it('returns true for "a"', () => {
    expect(isDynamicLabelKey('a')).toBe(true);
  });

  it('returns true for "b"', () => {
    expect(isDynamicLabelKey('b')).toBe(true);
  });

  it('returns true for "e"', () => {
    expect(isDynamicLabelKey('e')).toBe(true);
  });

  it('returns true for "f"', () => {
    expect(isDynamicLabelKey('f')).toBe(true);
  });

  it('returns false for "c" (action key)', () => {
    expect(isDynamicLabelKey('c')).toBe(false);
  });

  it('returns false for "x" (action key)', () => {
    expect(isDynamicLabelKey('x')).toBe(false);
  });

  it('returns false for "p" (action key)', () => {
    expect(isDynamicLabelKey('p')).toBe(false);
  });

  it('returns false for a key not in LABEL_POOL', () => {
    expect(isDynamicLabelKey('ArrowDown')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isDynamicLabelKey('')).toBe(false);
  });
});

describe('getActionForKey', () => {
  it('returns "close-tab" for "c"', () => {
    expect(getActionForKey('c')).toBe('close-tab');
  });

  it('returns "close-other-tabs" for "x"', () => {
    expect(getActionForKey('x')).toBe('close-other-tabs');
  });

  it('returns "pin-tab" for "p"', () => {
    expect(getActionForKey('p')).toBe('pin-tab');
  });

  it('returns "mute-tab" for "m"', () => {
    expect(getActionForKey('m')).toBe('mute-tab');
  });

  it('returns "duplicate-tab" for "d"', () => {
    expect(getActionForKey('d')).toBe('duplicate-tab');
  });

  it('returns "move-to-window" for "w"', () => {
    expect(getActionForKey('w')).toBe('move-to-window');
  });

  it('returns "reload-tab" for "r"', () => {
    expect(getActionForKey('r')).toBe('reload-tab');
  });

  it('returns "new-tab" for "t"', () => {
    expect(getActionForKey('t')).toBe('new-tab');
  });

  it('returns "go-to-url" for "u"', () => {
    expect(getActionForKey('u')).toBe('go-to-url');
  });

  it('returns "recently-closed" for "z"', () => {
    expect(getActionForKey('z')).toBe('recently-closed');
  });

  it('returns "close-duplicates" for "q"', () => {
    expect(getActionForKey('q')).toBe('close-duplicates');
  });

  it('returns "sort-by-domain" for "s"', () => {
    expect(getActionForKey('s')).toBe('sort-by-domain');
  });

  it('returns "settings" for ","', () => {
    expect(getActionForKey(',')).toBe('settings');
  });

  it('returns null for an unknown key', () => {
    expect(getActionForKey('a')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getActionForKey('')).toBeNull();
  });
});

describe('LABEL_POOL', () => {
  it('has 14 entries', () => {
    expect(LABEL_POOL).toHaveLength(14);
  });

  it('does not include any action keys', () => {
    const actionKeyList = ['c', 'x', 'p', 'm', 'd', 'w', 'r', 't', 'u', 'z', 'q', 's', ','];
    LABEL_POOL.forEach(key => {
      expect(actionKeyList).not.toContain(key);
    });
  });
});
