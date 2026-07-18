import { useMemo, useCallback, useRef } from 'react';
import { assignLabels } from '../lib/labels';

export function useLabelAssignment(visibleItemCount: number): {
  labels: Map<number, string>;
  labelToIndex: Map<string, number>;
  handleKeyPress: (key: string) => { targetIndex: number | null; consumed: boolean };
  clearPending: () => void;
} {
  // A ref, deliberately NOT state: the pending prefix must be visible to
  // the very next keypress even when both keys land in the same frame —
  // state would race the effect that re-attaches the key listener, and a
  // rapid two-char combo (fast typing, key autorepeat) would be dropped or
  // misrouted by the stale closure. Nothing renders from it.
  const pendingPrefixRef = useRef<string | null>(null);

  // Build the two lookup maps whenever the count changes
  const { labels, labelToIndex } = useMemo(() => {
    const assignments = assignLabels(visibleItemCount);
    const labels = new Map<number, string>();
    const labelToIndex = new Map<string, number>();
    for (const { index, label } of assignments) {
      labels.set(index, label);
      labelToIndex.set(label, index);
    }
    return { labels, labelToIndex };
  }, [visibleItemCount]);

  // Precompute the set of valid two-char label prefixes
  const twoCharPrefixes = useMemo(() => {
    const prefixes = new Set<string>();
    for (const label of labelToIndex.keys()) {
      if (label.length === 2) {
        prefixes.add(label[0]);
      }
    }
    return prefixes;
  }, [labelToIndex]);

  const clearPending = useCallback(() => {
    pendingPrefixRef.current = null;
  }, []);

  const handleKeyPress = useCallback(
    (key: string): { targetIndex: number | null; consumed: boolean } => {
      if (pendingPrefixRef.current !== null) {
        // We have a pending prefix; try to complete a two-char label
        const combo = pendingPrefixRef.current + key;
        pendingPrefixRef.current = null;
        const idx = labelToIndex.get(combo);
        if (idx !== undefined) {
          return { targetIndex: idx, consumed: true };
        }
        // No match for the combo — consumed but no target
        return { targetIndex: null, consumed: true };
      }

      // No pending prefix
      // Check for an exact single-char label match
      if (key.length === 1) {
        const idx = labelToIndex.get(key);
        if (idx !== undefined) {
          // But only if this key can't also be a two-char prefix
          // If it IS a two-char prefix, we need to wait for the second char
          if (twoCharPrefixes.has(key)) {
            pendingPrefixRef.current = key;
            return { targetIndex: null, consumed: true };
          }
          return { targetIndex: idx, consumed: true };
        }
      }

      // Check if this key could start a two-char label
      if (twoCharPrefixes.has(key)) {
        pendingPrefixRef.current = key;
        return { targetIndex: null, consumed: true };
      }

      // Not a label key at all
      return { targetIndex: null, consumed: false };
    },
    [labelToIndex, twoCharPrefixes]
  );

  return { labels, labelToIndex, handleKeyPress, clearPending };
}
