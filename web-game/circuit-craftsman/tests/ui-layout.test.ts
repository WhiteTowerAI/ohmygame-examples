import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

test('gameplay omits secondary side text and footer without stale selectors', () => {
  for (const className of ['region-sign', 'district-lights', 'repair-journal', 'apprentice-tag', 'world-footer', 'world-trail']) {
    assert(!main.includes(className), `Removed markup and HUD binding: ${className}`);
    assert(!css.includes(className), `Removed obsolete styles: ${className}`);
  }
  for (const id of ['region-number', 'region-subtitle', 'region-name', 'district-progress', 'journal-number', 'journal-bulbs', 'journal-grid', 'journal-stamp', 'campaign-progress', 'footer-region', 'save-status', 'top-region']) {
    assert(!main.includes(`#${id}`), `Removed HUD selector: ${id}`);
  }
  for (const id of ['board-host', 'moves', 'bulbs', 'undo-button', 'hint-button']) {
    assert(main.includes(`id="${id}"`), `Essential gameplay control remains: ${id}`);
  }
  assert(main.includes("toast(t('storageError'))"), 'Storage failures still notify the player');
});

test('level selection and settings omit decorative text while switches stay centered', () => {
  for (const className of ['district-caption', 'selection-total', 'settings-footer']) {
    assert(!main.includes(className));
    assert(!css.includes(className));
  }
  assert(!main.includes('小镇维修计划'));
  assert(!main.includes('已修复'));
  assert(!main.includes('区域 ${'));
  assert(main.includes("<h2>${t('levels')}</h2>"));
  assert(main.includes('data-testid="level-${level.id}"'));
  const thumb = css.match(/\.switch i::after \{([^}]+)\}/)?.[1] ?? '';
  assert(thumb.includes('box-sizing: border-box'));
  assert(thumb.includes('top: 50%'));
  assert(thumb.includes('translateY(-50%)'));
  assert(css.includes('.switch input:checked + i::after { transform: translate(30px, -50%);'));
});
