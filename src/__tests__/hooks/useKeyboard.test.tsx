// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboard } from '../../hooks/useKeyboard';
import type { RefObject } from 'react';

function fireKeyDown(el: HTMLElement, key: string, extra: Partial<KeyboardEvent> = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...extra,
  });
  el.dispatchEvent(event);
  return event;
}

function createContainerRef(): RefObject<HTMLDivElement> {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return { current: div };
}

describe('useKeyboard', () => {
  it('moves down on ArrowDown', () => {
    const onMove = vi.fn();
    const containerRef = createContainerRef();

    renderHook(() =>
      useKeyboard(containerRef, {
        totalItems: 5,
        selectedIndex: 0,
        onMove,
        onExecute: vi.fn(),
        onDismiss: vi.fn(),
        groupBoundaries: [0, 3],
        query: 'test',
      })
    );

    fireKeyDown(containerRef.current!, 'ArrowDown');
    expect(onMove).toHaveBeenCalledWith(1);
  });

  it('wraps to 0 on ArrowDown at end', () => {
    const onMove = vi.fn();
    const containerRef = createContainerRef();

    renderHook(() =>
      useKeyboard(containerRef, {
        totalItems: 5,
        selectedIndex: 4,
        onMove,
        onExecute: vi.fn(),
        onDismiss: vi.fn(),
        groupBoundaries: [0, 3],
        query: 'test',
      })
    );

    fireKeyDown(containerRef.current!, 'ArrowDown');
    expect(onMove).toHaveBeenCalledWith(0);
  });

  it('moves up on ArrowUp', () => {
    const onMove = vi.fn();
    const containerRef = createContainerRef();

    renderHook(() =>
      useKeyboard(containerRef, {
        totalItems: 5,
        selectedIndex: 2,
        onMove,
        onExecute: vi.fn(),
        onDismiss: vi.fn(),
        groupBoundaries: [0, 3],
        query: 'test',
      })
    );

    fireKeyDown(containerRef.current!, 'ArrowUp');
    expect(onMove).toHaveBeenCalledWith(1);
  });

  it('wraps to last on ArrowUp at start', () => {
    const onMove = vi.fn();
    const containerRef = createContainerRef();

    renderHook(() =>
      useKeyboard(containerRef, {
        totalItems: 5,
        selectedIndex: 0,
        onMove,
        onExecute: vi.fn(),
        onDismiss: vi.fn(),
        groupBoundaries: [0, 3],
        query: 'test',
      })
    );

    fireKeyDown(containerRef.current!, 'ArrowUp');
    expect(onMove).toHaveBeenCalledWith(4);
  });

  it('calls onExecute on Enter', () => {
    const onExecute = vi.fn();
    const containerRef = createContainerRef();

    renderHook(() =>
      useKeyboard(containerRef, {
        totalItems: 5,
        selectedIndex: 1,
        onMove: vi.fn(),
        onExecute,
        onDismiss: vi.fn(),
        groupBoundaries: [0, 3],
        query: 'test',
      })
    );

    fireKeyDown(containerRef.current!, 'Enter');
    expect(onExecute).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss on Escape', () => {
    const onDismiss = vi.fn();
    const containerRef = createContainerRef();

    renderHook(() =>
      useKeyboard(containerRef, {
        totalItems: 5,
        selectedIndex: 0,
        onMove: vi.fn(),
        onExecute: vi.fn(),
        onDismiss,
        groupBoundaries: [0, 3],
        query: 'test',
      })
    );

    fireKeyDown(containerRef.current!, 'Escape');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss on Backspace when query is empty', () => {
    const onDismiss = vi.fn();
    const containerRef = createContainerRef();

    renderHook(() =>
      useKeyboard(containerRef, {
        totalItems: 5,
        selectedIndex: 0,
        onMove: vi.fn(),
        onExecute: vi.fn(),
        onDismiss,
        groupBoundaries: [0, 3],
        query: '',
      })
    );

    fireKeyDown(containerRef.current!, 'Backspace');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not call onDismiss on Backspace when query is not empty', () => {
    const onDismiss = vi.fn();
    const containerRef = createContainerRef();

    renderHook(() =>
      useKeyboard(containerRef, {
        totalItems: 5,
        selectedIndex: 0,
        onMove: vi.fn(),
        onExecute: vi.fn(),
        onDismiss,
        groupBoundaries: [0, 3],
        query: 'hello',
      })
    );

    fireKeyDown(containerRef.current!, 'Backspace');
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('jumps to next group boundary on Tab', () => {
    const onMove = vi.fn();
    const containerRef = createContainerRef();

    renderHook(() =>
      useKeyboard(containerRef, {
        totalItems: 5,
        selectedIndex: 0,
        onMove,
        onExecute: vi.fn(),
        onDismiss: vi.fn(),
        groupBoundaries: [0, 3],
        query: 'test',
      })
    );

    fireKeyDown(containerRef.current!, 'Tab');
    expect(onMove).toHaveBeenCalledWith(3);
  });

  it('wraps to first group boundary on Tab at end', () => {
    const onMove = vi.fn();
    const containerRef = createContainerRef();

    renderHook(() =>
      useKeyboard(containerRef, {
        totalItems: 5,
        selectedIndex: 3,
        onMove,
        onExecute: vi.fn(),
        onDismiss: vi.fn(),
        groupBoundaries: [0, 3],
        query: 'test',
      })
    );

    fireKeyDown(containerRef.current!, 'Tab');
    expect(onMove).toHaveBeenCalledWith(0);
  });

  it('jumps to previous group boundary on Shift+Tab', () => {
    const onMove = vi.fn();
    const containerRef = createContainerRef();

    renderHook(() =>
      useKeyboard(containerRef, {
        totalItems: 5,
        selectedIndex: 4,
        onMove,
        onExecute: vi.fn(),
        onDismiss: vi.fn(),
        groupBoundaries: [0, 3],
        query: 'test',
      })
    );

    fireKeyDown(containerRef.current!, 'Tab', { shiftKey: true });
    expect(onMove).toHaveBeenCalledWith(3);
  });

  it('does nothing on ArrowDown when totalItems is 0', () => {
    const onMove = vi.fn();
    const containerRef = createContainerRef();

    renderHook(() =>
      useKeyboard(containerRef, {
        totalItems: 0,
        selectedIndex: 0,
        onMove,
        onExecute: vi.fn(),
        onDismiss: vi.fn(),
        groupBoundaries: [],
        query: 'test',
      })
    );

    fireKeyDown(containerRef.current!, 'ArrowDown');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('does nothing on ArrowUp when totalItems is 0', () => {
    const onMove = vi.fn();
    const containerRef = createContainerRef();

    renderHook(() =>
      useKeyboard(containerRef, {
        totalItems: 0,
        selectedIndex: 0,
        onMove,
        onExecute: vi.fn(),
        onDismiss: vi.fn(),
        groupBoundaries: [],
        query: 'test',
      })
    );

    fireKeyDown(containerRef.current!, 'ArrowUp');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('does nothing on Tab when groupBoundaries is empty', () => {
    const onMove = vi.fn();
    const containerRef = createContainerRef();

    renderHook(() =>
      useKeyboard(containerRef, {
        totalItems: 5,
        selectedIndex: 1,
        onMove,
        onExecute: vi.fn(),
        onDismiss: vi.fn(),
        groupBoundaries: [],
        query: '',
      })
    );

    fireKeyDown(containerRef.current!, 'Tab');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('Shift+Tab wraps to the last group boundary when no previous boundary exists', () => {
    const onMove = vi.fn();
    const containerRef = createContainerRef();

    // selectedIndex=0 is the first/only boundary — Shift+Tab has no
    // earlier boundary to find, so it wraps to the last one in the list.
    renderHook(() =>
      useKeyboard(containerRef, {
        totalItems: 5,
        selectedIndex: 0,
        onMove,
        onExecute: vi.fn(),
        onDismiss: vi.fn(),
        groupBoundaries: [0, 3],
        query: '',
      })
    );

    fireKeyDown(containerRef.current!, 'Tab', { shiftKey: true });
    expect(onMove).toHaveBeenCalledWith(3);
  });
});
