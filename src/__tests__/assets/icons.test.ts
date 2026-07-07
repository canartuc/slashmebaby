// Guards the extension icon assets that WXT auto-discovers from public/.
//
// WXT (node_modules/wxt/dist/core/utils/manifest.mjs → discoverIcons) builds
// the manifest `icons` map from public assets whose filenames match
// /^icon-([0-9]+)\.png$/ (among other variants). These tests pin the exact
// filenames, PNG validity, and pixel dimensions so a rename or a bad
// regeneration fails CI instead of silently shipping an icon-less manifest.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');

/** First (canonical) filename pattern accepted by WXT's discoverIcons(). */
const WXT_ICON_PATTERN = /^icon-([0-9]+)\.png$/;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Reads width/height from a PNG's IHDR chunk (always the first chunk). */
function readPngSize(filePath: string): { width: number; height: number } {
  const buf = readFileSync(filePath);
  expect(buf.length).toBeGreaterThan(24);
  expect(buf.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  // 8-byte signature + 4-byte length + 4-byte "IHDR" → width @16, height @20
  expect(buf.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('extension icons in public/', () => {
  const sizes = [16, 32, 48, 128] as const;

  it.each(sizes)('ships icon-%i.png matching the WXT discoverIcons pattern', (size) => {
    const fileName = `icon-${size}.png`;
    const match = fileName.match(WXT_ICON_PATTERN);
    expect(match?.[1]).toBe(String(size));
    expect(existsSync(resolve(ROOT, 'public', fileName))).toBe(true);
  });

  it.each(sizes)('icon-%i.png is a valid PNG with exact %ix%i dimensions', (size) => {
    const { width, height } = readPngSize(resolve(ROOT, 'public', `icon-${size}.png`));
    expect(width).toBe(size);
    expect(height).toBe(size);
  });
});

describe('store assets in store-assets/', () => {
  it('ships a 128x128 icon copy for store listings', () => {
    const filePath = resolve(ROOT, 'store-assets', 'icon-128.png');
    expect(existsSync(filePath)).toBe(true);
    const { width, height } = readPngSize(filePath);
    expect(width).toBe(128);
    expect(height).toBe(128);
  });

  it('ships a 440x280 small promo tile', () => {
    const filePath = resolve(ROOT, 'store-assets', 'promo-tile-440x280.png');
    expect(existsSync(filePath)).toBe(true);
    const { width, height } = readPngSize(filePath);
    expect(width).toBe(440);
    expect(height).toBe(280);
  });
});
