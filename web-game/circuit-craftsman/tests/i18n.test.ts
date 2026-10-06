import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { image, pixelTestOptions } from './image';
import { TEXT, LANGUAGES, ENGLISH_LEVEL_NAMES, REGION_NAMES, SKIN_NAMES, text, levelName } from '../src/i18n';
import { LEVELS } from '../src/game/levels';
import { GameSession } from '../src/game/session';
import { defaultProgress, parseProgress, SKINS } from '../src/game/save';
import { ART_FILES } from '../src/art-files';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('English is the default and legacy or invalid language values do not reset progress', () => {
  assert.equal(defaultProgress().language, 'en');
  const legacy = {version: 1, unlocked: 7, stars: [3,2,1,3,2,1], muted: true, lastLevel: 5};
  for (const language of [undefined, 'fr', null, {}, 1]) {
    const saved = parseProgress(JSON.stringify({...legacy, language}));
    assert.equal(saved.language, 'en');
    assert.equal(saved.unlocked, 7);
    assert.equal(saved.lastLevel, 5);
    assert.deepEqual(saved.stars.slice(0,6), legacy.stars);
    assert.equal(saved.muted, true);
  }
  for (const language of LANGUAGES) assert.equal(parseProgress(JSON.stringify({...legacy, language})).language, language);
});

test('language changes persist without altering the live puzzle or its scoring', () => {
  let saved = '';
  const session = new GameSession(defaultProgress(), progress => {saved = JSON.stringify(progress);});
  session.rotate(6);
  const before = {rotations:[...session.rotations], moves:session.moves, history:[...session.history], revision:session.revision};
  session.setOverlay('settings');
  const events: string[] = [];
  session.subscribe(event => events.push(event.type));
  session.setLanguage('zh');
  assert.equal(session.overlay, 'settings');
  assert.equal(session.progress.language, 'zh');
  assert.equal(parseProgress(saved).language, 'zh');
  assert.deepEqual({rotations:session.rotations, moves:session.moves, history:session.history, revision:session.revision}, before);
  const restored = new GameSession(parseProgress(saved));
  assert.equal(restored.progress.language, 'zh');
  assert.deepEqual(restored.rotations, session.rotations);
  assert.equal(restored.moves, session.moves);
  session.setLanguage('en');
  assert.equal(parseProgress(saved).language, 'en');
  session.setLanguage('en');
  assert.deepEqual(events, ['settings','settings']);
});

test('both languages cover every menu key, forty levels, four regions and all skins', () => {
  assert.deepEqual(Object.keys(TEXT.en).sort(), Object.keys(TEXT.zh).sort());
  assert.equal(ENGLISH_LEVEL_NAMES.length, LEVELS.length);
  assert.equal(new Set(ENGLISH_LEVEL_NAMES).size, 40);
  for (const language of LANGUAGES) {
    assert(Object.values(TEXT[language]).every(value => value.trim().length > 0));
    assert.equal(REGION_NAMES[language].length, 4);
    for (const skin of SKINS) assert(SKIN_NAMES[language][skin.id]);
    for (const level of LEVELS) {
      const name = levelName(language, level);
      assert(name);
      if (language === 'en') assert(!/[\u4e00-\u9fff]/.test(name));
      else assert.equal(name, level.name);
    }
    assert(!text(language,'boardLabel',{size:7,count:5}).includes('{'));
    assert(!text(language,'levelLabel',{level:40,name:levelName(language,LEVELS[39]),status:text(language,'locked')}).includes('{'));
  }
});

test('English logo is transparent, unclipped and shared by loading and gameplay', pixelTestOptions, () => {
  const manifest = JSON.parse(read('public/art/circuit-craftsman/manifest.json'));
  assert(ART_FILES['logo-small-en'].startsWith('branding/'));
  const pixels = image('logo-small-en');
  assert.deepEqual([pixels.width, pixels.height], [512, 256]);
  const entry = manifest.assets.find((asset: any) => asset.id === 'logo-small-en');
  assert(entry);
  assert(entry.checks.transparentPixels > 0);
  assert.equal(entry.checks.edgeVisiblePixels, 0);
  assert(entry.checks.visiblePixels > pixels.width * pixels.height * .2);
  assert(!read('src/main.ts').includes("? 'logo-en' : 'logo'"));
});

test('language controls retain focus and localization excludes discarded result filler', () => {
  const main = read('src/main.ts');
  assert(main.includes('data-language="${language}"'));
  assert(main.includes('aria-pressed="${session.progress.language === language}"'));
  assert(main.includes("['language', 'action', 'setting', 'skin']"));
  assert(main.includes("document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'"));
  assert(!main.includes('照明设施全部通电'));
  assert(!main.includes('All lights are on'));
  assert(main.includes("session.usedHint ? `<span class=\"hint-result\">${t('hintUsed')}</span>` : ''"));
});
