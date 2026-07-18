// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLabelAssignment } from '../../hooks/useLabelAssignment';
import { LABEL_POOL } from '../../lib/labels';

describe('useLabelAssignment', () => {
  // ─── Map construction ───────────────────────────────────────────────────────

  it('returns empty maps for 0 items', () => {
    const { result } = renderHook(() => useLabelAssignment(0));
    expect(result.current.labels.size).toBe(0);
    expect(result.current.labelToIndex.size).toBe(0);
  });

  it('builds correct labels map for 5 items', () => {
    const { result } = renderHook(() => useLabelAssignment(5));
    expect(result.current.labels.size).toBe(5);
    expect(result.current.labels.get(0)).toBe('a');
    expect(result.current.labels.get(1)).toBe('b');
    expect(result.current.labels.get(2)).toBe('e');
    expect(result.current.labels.get(3)).toBe('f');
    expect(result.current.labels.get(4)).toBe('g');
  });

  it('builds correct labelToIndex map for 5 items', () => {
    const { result } = renderHook(() => useLabelAssignment(5));
    expect(result.current.labelToIndex.get('a')).toBe(0);
    expect(result.current.labelToIndex.get('b')).toBe(1);
    expect(result.current.labelToIndex.get('e')).toBe(2);
    expect(result.current.labelToIndex.get('f')).toBe(3);
    expect(result.current.labelToIndex.get('g')).toBe(4);
  });

  it('updates maps when visibleItemCount changes', () => {
    const { result, rerender } = renderHook(
      ({ count }) => useLabelAssignment(count),
      { initialProps: { count: 3 } }
    );
    expect(result.current.labels.size).toBe(3);

    rerender({ count: 10 });
    expect(result.current.labels.size).toBe(10);
  });

  // ─── Single-char label key press (small count, no two-char labels) ────────

  it('returns targetIndex for single-char label when count <= 24', () => {
    const { result } = renderHook(() => useLabelAssignment(5));

    let res: { targetIndex: number | null; consumed: boolean };
    act(() => {
      res = result.current.handleKeyPress('a');
    });
    expect(res!.targetIndex).toBe(0);
    expect(res!.consumed).toBe(true);
  });

  it('returns consumed:false for unknown key', () => {
    const { result } = renderHook(() => useLabelAssignment(5));

    let res: { targetIndex: number | null; consumed: boolean };
    act(() => {
      res = result.current.handleKeyPress('Z');
    });
    expect(res!.targetIndex).toBeNull();
    expect(res!.consumed).toBe(false);
  });

  // ─── Two-char labels (count > 24) ────────────────────────────────────────

  it('arms a pending prefix when a key could start a two-char label', () => {
    const { result } = renderHook(() => useLabelAssignment(30));
    // 'a' is both a single-char label AND the start of 'aa','ab'... —
    // pressing it must wait for the second char (consumed, no target).
    // The prefix itself is internal (a ref, same-frame safe); observe it by
    // completing the combo.
    act(() => {
      const res = result.current.handleKeyPress('a');
      expect(res.targetIndex).toBeNull();
      expect(res.consumed).toBe(true);
    });

    act(() => {
      const res = result.current.handleKeyPress('a');
      expect(res.targetIndex).toBe(14); // 'aa'
    });
  });

  it('completes a two-char label on second key press', () => {
    const { result } = renderHook(() => useLabelAssignment(30));

    // Press 'a' to arm the prefix
    act(() => {
      result.current.handleKeyPress('a');
    });

    // Press 'a' to complete 'aa' (index 14)
    let res: { targetIndex: number | null; consumed: boolean };
    act(() => {
      res = result.current.handleKeyPress('a');
    });
    expect(res!.targetIndex).toBe(14);
    expect(res!.consumed).toBe(true);

    // Prefix consumed: the next 'a' arms a fresh prefix (no target).
    act(() => {
      res = result.current.handleKeyPress('a');
    });
    expect(res!.targetIndex).toBeNull();
  });

  it('completes two-char label "ab" correctly', () => {
    const { result } = renderHook(() => useLabelAssignment(30));

    act(() => {
      result.current.handleKeyPress('a');
    });

    let res: { targetIndex: number | null; consumed: boolean };
    act(() => {
      res = result.current.handleKeyPress('b');
    });
    expect(res!.targetIndex).toBe(15);
    expect(res!.consumed).toBe(true);
  });

  it('returns null target for invalid two-char combo but consumed:true', () => {
    const { result } = renderHook(() => useLabelAssignment(30));

    // Press 'a' to set pending
    act(() => {
      result.current.handleKeyPress('a');
    });

    // Press something that doesn't form a valid label
    let res: { targetIndex: number | null; consumed: boolean };
    act(() => {
      res = result.current.handleKeyPress('Z');
    });
    expect(res!.targetIndex).toBeNull();
    expect(res!.consumed).toBe(true);
  });

  // ─── clearPending ─────────────────────────────────────────────────────────

  it('clearPending cancels an armed prefix', () => {
    const { result } = renderHook(() => useLabelAssignment(30));

    act(() => {
      result.current.handleKeyPress('a'); // arm
      result.current.clearPending();
    });

    // With the prefix cancelled, the next 'a' arms a fresh prefix instead
    // of completing 'aa'.
    act(() => {
      const res = result.current.handleKeyPress('a');
      expect(res.targetIndex).toBeNull();
      expect(res.consumed).toBe(true);
    });
  });

  // ─── Edge: key not in label pool at all ───────────────────────────────────

  it('does not consume action keys', () => {
    const { result } = renderHook(() => useLabelAssignment(5));

    let res: { targetIndex: number | null; consumed: boolean };
    act(() => {
      res = result.current.handleKeyPress('c');
    });
    expect(res!.consumed).toBe(false);
  });

  it('does not consume arrow keys', () => {
    const { result } = renderHook(() => useLabelAssignment(5));

    let res: { targetIndex: number | null; consumed: boolean };
    act(() => {
      res = result.current.handleKeyPress('ArrowDown');
    });
    expect(res!.consumed).toBe(false);
  });

  // ─── When count fits exactly in single-char pool (24 items) ───────────────

  it('all 14 labels are single-char and resolve directly', () => {
    const { result } = renderHook(() => useLabelAssignment(14));

    // Each label key should directly resolve
    for (let i = 0; i < 14; i++) {
      const key = LABEL_POOL[i];
      let res: { targetIndex: number | null; consumed: boolean };
      act(() => {
        res = result.current.handleKeyPress(key);
      });
      expect(res!.targetIndex).toBe(i);
      expect(res!.consumed).toBe(true);
    }
  });

  // ─── Pending state does not leak across re-renders ────────────────────────

  it('pending state persists across item count changes', () => {
    const { result, rerender } = renderHook(
      ({ count }) => useLabelAssignment(count),
      { initialProps: { count: 30 } }
    );

    act(() => {
      result.current.handleKeyPress('a');
    });

    // Changing count doesn't clear the armed prefix (independent ref)
    rerender({ count: 5 });
    // pendingPrefix is still 'a' but the maps changed - pressing next key
    // should attempt combo 'ab' which doesn't exist when count=5
    let res: { targetIndex: number | null; consumed: boolean };
    act(() => {
      res = result.current.handleKeyPress('b');
    });
    // 'ab' is not a valid label when count=5, so null target
    expect(res!.targetIndex).toBeNull();
    expect(res!.consumed).toBe(true);
  });
});
