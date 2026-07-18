// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { routePaletteKey } from '../../lib/palette-keys';

function fakeKey(opts: {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}): KeyboardEvent {
  return {
    key: opts.key,
    shiftKey: !!opts.shiftKey,
    ctrlKey: !!opts.ctrlKey,
    metaKey: !!opts.metaKey,
    altKey: !!opts.altKey,
  } as unknown as KeyboardEvent;
}

function writableInput(value = ''): HTMLInputElement {
  const input = document.createElement('input');
  input.value = value;
  return input;
}

function readonlyInput(value = ''): HTMLInputElement {
  const input = writableInput(value);
  input.readOnly = true;
  return input;
}

describe('routePaletteKey', () => {
  it('Escape yields dismiss', () => {
    expect(routePaletteKey(fakeKey({ key: 'Escape' }), { activeElement: null })).toEqual({
      kind: 'dismiss',
    });
  });

  it('forwards navigation keys even while the search input is focused', () => {
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab']) {
      const decision = routePaletteKey(fakeKey({ key }), {
        activeElement: writableInput('some text'),
      });
      expect(decision).toEqual({ kind: 'forward', key, shiftKey: false });
    }
  });

  it('passes printable keys to a focused writable input', () => {
    const decision = routePaletteKey(fakeKey({ key: 'a' }), {
      activeElement: writableInput('quer'),
    });
    expect(decision).toEqual({ kind: 'pass' });
  });

  it('forwards printable keys when no writable input is focused (jump mode)', () => {
    const decision = routePaletteKey(fakeKey({ key: 'a' }), { activeElement: null });
    expect(decision).toEqual({ kind: 'forward', key: 'a', shiftKey: false });
  });

  it('does not treat a readonly input as a writable search input', () => {
    const decision = routePaletteKey(fakeKey({ key: 'c' }), {
      activeElement: readonlyInput(),
    });
    expect(decision).toEqual({ kind: 'forward', key: 'c', shiftKey: false });
  });

  it("'/' forwards when the focused input is empty", () => {
    const decision = routePaletteKey(fakeKey({ key: '/' }), {
      activeElement: writableInput(''),
    });
    expect(decision).toEqual({ kind: 'forward', key: '/', shiftKey: false });
  });

  it("'/' passes when the focused input has text", () => {
    const decision = routePaletteKey(fakeKey({ key: '/' }), {
      activeElement: writableInput('example.com'),
    });
    expect(decision).toEqual({ kind: 'pass' });
  });

  it("'/' forwards when no input is focused", () => {
    const decision = routePaletteKey(fakeKey({ key: '/' }), { activeElement: null });
    expect(decision).toEqual({ kind: 'forward', key: '/', shiftKey: false });
  });

  it('lowercases single-character keys and preserves shiftKey', () => {
    const decision = routePaletteKey(fakeKey({ key: 'C', shiftKey: true }), {
      activeElement: null,
    });
    expect(decision).toEqual({ kind: 'forward', key: 'c', shiftKey: true });
  });

  it('keeps multi-character key names unchanged when forwarding', () => {
    const decision = routePaletteKey(fakeKey({ key: 'ArrowDown', shiftKey: true }), {
      activeElement: null,
    });
    expect(decision).toEqual({ kind: 'forward', key: 'ArrowDown', shiftKey: true });
  });

  it('Backspace is not special-cased: passes with a writable input, forwards without one', () => {
    expect(
      routePaletteKey(fakeKey({ key: 'Backspace' }), { activeElement: writableInput('abc') })
    ).toEqual({ kind: 'pass' });
    expect(routePaletteKey(fakeKey({ key: 'Backspace' }), { activeElement: null })).toEqual({
      kind: 'forward',
      key: 'Backspace',
      shiftKey: false,
    });
  });

  it('passes any key when Ctrl, Meta, or Alt is held (browser chords are never palette keys)', () => {
    // Ctrl/Cmd+C must never fire the close-tab action; Shift stays allowed
    // (Shift+Enter, Shift+Tab, shift-labels).
    expect(routePaletteKey(fakeKey({ key: 'c', ctrlKey: true }), { activeElement: null })).toEqual({ kind: 'pass' });
    expect(routePaletteKey(fakeKey({ key: 'c', metaKey: true }), { activeElement: null })).toEqual({ kind: 'pass' });
    expect(routePaletteKey(fakeKey({ key: 'r', metaKey: true }), { activeElement: null })).toEqual({ kind: 'pass' });
    expect(routePaletteKey(fakeKey({ key: 'a', altKey: true }), { activeElement: null })).toEqual({ kind: 'pass' });
    expect(routePaletteKey(fakeKey({ key: 'Enter', ctrlKey: true }), { activeElement: null })).toEqual({ kind: 'pass' });
    // Escape stays dismiss even with a modifier? No — chords pass entirely.
    expect(routePaletteKey(fakeKey({ key: 'Escape', ctrlKey: true }), { activeElement: null })).toEqual({ kind: 'pass' });
  });

  it('passes bare modifier keydowns (they must not disturb an armed label prefix)', () => {
    // Pressing Shift to type a shifted combo char emits a 'Shift' keydown
    // first; forwarding it would burn the pending two-char prefix.
    for (const key of ['Shift', 'Control', 'Alt', 'Meta']) {
      expect(routePaletteKey(fakeKey({ key, shiftKey: key === 'Shift' }), { activeElement: null })).toEqual({
        kind: 'pass',
      });
    }
  });

  it('treats a non-input active element like jump mode', () => {
    const div = document.createElement('div');
    const decision = routePaletteKey(fakeKey({ key: 'x' }), { activeElement: div });
    expect(decision).toEqual({ kind: 'forward', key: 'x', shiftKey: false });
  });
});
