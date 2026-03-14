import { useEffect, useCallback, type RefObject } from 'react';

export interface UseKeyboardOptions {
  totalItems: number;
  selectedIndex: number;
  onMove: (newIndex: number) => void;
  onExecute: () => void;
  onDismiss: () => void;
  groupBoundaries: number[]; // flat indices where each group starts
  query: string;
}

/**
 * Attaches keyboard navigation listeners to a container element (Shadow DOM safe).
 * Handles arrow keys, tab/shift-tab group jumping, enter, escape, and backspace-to-dismiss.
 */
export function useKeyboard(
  containerRef: RefObject<HTMLElement | null>,
  options: UseKeyboardOptions
): void {
  const {
    totalItems,
    selectedIndex,
    onMove,
    onExecute,
    onDismiss,
    groupBoundaries,
    query,
  } = options;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          if (totalItems === 0) return;
          const next = selectedIndex >= totalItems - 1 ? 0 : selectedIndex + 1;
          onMove(next);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (totalItems === 0) return;
          const prev = selectedIndex <= 0 ? totalItems - 1 : selectedIndex - 1;
          onMove(prev);
          break;
        }
        case 'Tab': {
          e.preventDefault();
          if (totalItems === 0 || groupBoundaries.length === 0) return;
          if (e.shiftKey) {
            // Jump to previous group boundary
            const prevBoundary = [...groupBoundaries]
              .reverse()
              .find((b) => b < selectedIndex);
            onMove(prevBoundary ?? groupBoundaries[groupBoundaries.length - 1]);
          } else {
            // Jump to next group boundary
            const nextBoundary = groupBoundaries.find((b) => b > selectedIndex);
            onMove(nextBoundary ?? groupBoundaries[0]);
          }
          break;
        }
        case 'Enter': {
          e.preventDefault();
          onExecute();
          break;
        }
        case 'Escape': {
          e.preventDefault();
          onDismiss();
          break;
        }
        case 'Backspace': {
          if (query === '') {
            e.preventDefault();
            onDismiss();
          }
          break;
        }
      }
    },
    [totalItems, selectedIndex, onMove, onExecute, onDismiss, groupBoundaries, query]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('keydown', handleKeyDown as EventListener);
    return () => {
      el.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [containerRef, handleKeyDown]);
}
