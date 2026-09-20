import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from '../../scripts/lib/server.mjs';
import { validateSite } from '../../scripts/lib/validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SLUG = path.basename(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const OUTPUT = path.join(ROOT, 'test-results', SLUG);

async function assertTextFits(page) {
  const issues = await page.evaluate(() => {
    const slide = document.querySelector('.slide.is-active');
    const bounds = slide.getBoundingClientRect();
    return [...slide.querySelectorAll('h1,h2,p,blockquote,.countdown,.final-name')].flatMap((element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (element.closest('.speaker-notes') || !box.width || !box.height || style.visibility === 'hidden' || Number(style.opacity) === 0) return [];
      if (box.left < bounds.left - 2 || box.top < bounds.top - 2 || box.right > bounds.right + 2 || box.bottom > bounds.bottom + 2 || element.scrollWidth > element.clientWidth + 3) return [element.className || element.tagName];
      return [];
    });
  });
  assert.deepEqual(issues, [], '표시 텍스트가 슬라이드 영역을 벗어나면 안 됩니다.');
}

async function verifyInteractions({ page, baseUrl }) {
  const url = `${baseUrl}/${SLUG}/`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.commentAwards);
  assert.equal(await page.locator('.slide').count(), 12);
  assert.equal(await page.locator('a[href$=".pdf"], .deck-download').count(), 0);
  assert.deepEqual(await page.locator('.winner-name').allTextContents(), ['김규민', '윤도경', '신지안']);
  assert.equal(await page.locator('[data-template-placeholder]').count(), 0);
  const defaults = await page.evaluate(() => window.COMMENT_AWARDS_CONTENT.winners);
  assert.deepEqual(await page.locator('.featured-comment').allTextContents(), defaults.map((winner) => winner.comment.trim()));

  const stillStyle = await page.addStyleTag({ content: '.slide,.slide * { animation:none !important; transition:none !important; }' });
  for (let index = 0; index < 12; index += 1) {
    await page.evaluate((i) => window.ppt205Deck.go(i), index);
    await page.waitForTimeout(100);
    await assertTextFits(page);
    await page.locator('.deck-stage').screenshot({ path: path.join(OUTPUT, `slide-${String(index + 1).padStart(2, '0')}.png`) });
  }
  await stillStyle.evaluate((element) => element.remove());

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('[data-awards-start]').click();
  assert.equal(await page.evaluate(() => window.commentAwards.getState().running), true);
  const levels = [];
  for (let i = 0; i < 5; i += 1) {
    await page.waitForTimeout(100);
    levels.push(await page.evaluate(() => window.commentAwards.getState().audioLevel));
  }
  const sound = await page.evaluate(() => window.commentAwards.getState());
  assert.equal(sound.audioState, 'running', '사용자 클릭 뒤 AudioContext가 재생 상태여야 합니다.');
  assert.ok(sound.audioCueCount > 0 && Math.max(...levels) > .00001, '실제 효과음 출력 신호를 확인해야 합니다.');
  await page.locator('[data-awards-toggle]').click();
  const paused = await page.evaluate(() => window.commentAwards.getState());
  await page.waitForTimeout(180);
  assert.equal(await page.evaluate(() => window.commentAwards.getState().elapsed), paused.elapsed);

  await page.clock.install();
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-awards-sound]').click();
  await page.locator('[data-awards-start]').click();
  await page.clock.runFor(14100);
  assert.equal(await page.evaluate(() => window.ppt205Deck.current), 2, '첫 수상자 공개 전 화면에 도달해야 합니다.');
  await page.clock.runFor(3000);
  assert.equal(await page.locator('.slide.is-active .countdown').textContent(), '3');
  await page.clock.runFor(1000);
  assert.equal(await page.locator('.slide.is-active .countdown').textContent(), '2');
  await page.clock.runFor(1000);
  assert.equal(await page.locator('.slide.is-active .countdown').textContent(), '1');
  await page.clock.runFor(1200);
  assert.equal(await page.evaluate(() => window.ppt205Deck.current), 3);
  await page.clock.runFor(1800);
  await page.locator('.deck-stage').screenshot({ path: path.join(OUTPUT, 'reveal-motion.png') });
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Space');
  const freeze = await page.evaluate(() => window.commentAwards.getState());
  assert.equal(freeze.running, false);
  await page.clock.runFor(5000);
  assert.equal(await page.evaluate(() => window.commentAwards.getState().elapsed), freeze.elapsed);
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => window.commentAwards.getState().running), true);
  await page.clock.runFor(110000);
  const completed = await page.evaluate(() => window.commentAwards.getState());
  assert.equal(completed.index, 11);
  assert.equal(completed.ended, true);
  assert.equal(completed.running, false);
  await page.clock.runFor(30000);
  assert.equal(await page.evaluate(() => window.ppt205Deck.current), 11, '마지막 화면은 자동 반복하지 않고 유지해야 합니다.');
  await page.locator('[data-awards-restart]').click();
  assert.equal(await page.evaluate(() => window.ppt205Deck.current), 0);
  await page.locator('[data-awards-toggle]').click();

  await page.locator('[data-awards-edit]').click();
  await page.locator('[name="eventLabel"]').fill('화면 검수용 행사');
  const longName = '긴닉네임표시범위를확인하는검수용학생이름입력'.slice(0, 24);
  const longReason = '친구가 만든 작품의 장면과 조작을 자세히 살피고, 어떤 점이 좋았는지와 더 나아질 부분을 구체적인 예로 친절하게 전했습니다.'.slice(0, 90);
  const longComment = ('작품에서 골대에 공이 닿았을 때 점수가 바뀌는 부분이 재미있었어요. 다음에는 숫자가 조금 더 오래 보이면 좋겠어요. ').repeat(5).slice(0, 220);
  for (let i = 0; i < 3; i += 1) {
    await page.locator(`[name="winner-${i}-name"]`).fill(longName);
    await page.locator(`[name="winner-${i}-reason"]`).fill(longReason);
    await page.locator(`[name="winner-${i}-comment"]`).fill(longComment);
    await page.locator(`[name="winner-${i}-project"]`).fill('길이가 긴 작품 제목의 표시 범위를 확인하는 검수용 제목입니다');
  }
  await page.locator('[name="revealDuration"]').fill('15');
  await page.locator('[name="evidenceDuration"]').fill('20');
  await page.locator('button[type="submit"]').click();
  assert.equal(await page.evaluate(() => window.commentAwards.getState().totalDuration), 137000);
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('.winner-name').first().textContent(), longName, '내용은 같은 브라우저에서 유지되어야 합니다.');
  for (const index of [3, 4, 6, 7, 9, 10, 11]) {
    await page.evaluate((i) => window.ppt205Deck.go(i), index);
    await page.clock.runFor(200);
    await assertTextFits(page);
    if ([3, 4, 11].includes(index)) await page.locator('.deck-stage').screenshot({ path: path.join(OUTPUT, `long-content-${index + 1}.png`) });
  }
  await page.locator('[data-awards-edit]').click();
  await page.locator('[name="winner-0-comment"]').fill('<img src=x onerror=alert(1)> 입력한 문장은 문자 그대로 보여야 합니다.');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-config-export]').click();
  const exported = await downloadPromise;
  assert.equal(await exported.failure(), null);
  assert.equal(exported.suggestedFilename(), 'comment-awards-content.json');
  const exportPath = await exported.path();
  const exportedData = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  assert.equal(exportedData.winners.length, 3);
  await page.locator('[data-config-file]').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":1,"winners":[]}') });
  await page.waitForFunction(() => document.querySelector('[data-editor-message]').textContent.includes('불러오지 못했습니다'));
  assert.match(await page.locator('[data-editor-message]').textContent(), /불러오지 못했습니다/);
  await page.locator('[data-config-file]').setInputFiles({ name: 'content.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exportedData)) });
  await page.waitForFunction(() => document.querySelector('[data-editor-message]').textContent.includes('불러왔습니다'));
  assert.match(await page.locator('[data-editor-message]').textContent(), /불러왔습니다/);
  await page.locator('button[type="submit"]').click();
  await page.evaluate(() => window.ppt205Deck.go(4));
  await page.clock.runFor(100);
  assert.equal(await page.locator('.featured-comment img').count(), 0);
  assert.match(await page.locator('.featured-comment').first().textContent(), /<img src=x/);
  for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.clock.runFor(100);
    await assertTextFits(page);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  return { slides: 12, audioPeak: Math.max(...levels), automaticSequence: true, countdown: true, pauseResume: true, finalHold: true, restart: true, longContent: true, localStorage: true, contentExportImport: true, textInjectionSafe: true, responsive: true };
}

export default verifyInteractions;

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  fs.mkdirSync(OUTPUT, { recursive: true });
  await validateSite({ root: ROOT, slug: SLUG, requirePdfs: false });
  const server = await startServer(ROOT);
  const browser = await chromium.launch();
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, acceptDownloads: true });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    const report = await verifyInteractions({ page, baseUrl: server.url });
    const offline = await browser.newPage({ viewport: { width: 1440, height: 810 } });
    offline.on('pageerror', (error) => errors.push(error.message));
    await offline.goto(pathToFileURL(path.join(ROOT, SLUG, 'index.html')).href);
    await offline.waitForFunction(() => window.commentAwards);
    await offline.locator('[data-awards-start]').click();
    assert.equal(await offline.evaluate(() => window.commentAwards.getState().running), true);
    await offline.locator('[data-awards-toggle]').click();
    report.fileUrlPlayback = true;
    await offline.emulateMedia({ reducedMotion: 'reduce' });
    await offline.evaluate(() => window.ppt205Deck.go(3));
    assert.equal(await offline.locator('.winner-name').first().evaluate((element) => getComputedStyle(element).animationName), 'none');
    report.reducedMotion = true;
    const automatic = await browser.newPage();
    await automatic.goto(`${server.url}/${SLUG}/?autoplay=1`);
    await automatic.waitForFunction(() => window.commentAwards?.getState().running);
    assert.equal(await automatic.evaluate(() => window.commentAwards.getState().sound), false);
    report.mutedAutoplay = true;
    assert.deepEqual(errors, []);
    const contact = await browser.newPage({ viewport: { width: 1680, height: 860 } });
    await contact.setContent('<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:12px;background:#17140e;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0}img{width:100%;display:block}figcaption{font:13px system-ui;color:#dfc68a;padding:4px}</style>' + Array.from({ length: 12 }, (_, index) => `<figure><img src="data:image/png;base64,${fs.readFileSync(path.join(OUTPUT, `slide-${String(index + 1).padStart(2, '0')}.png`)).toString('base64')}"><figcaption>${index + 1}</figcaption></figure>`).join(''));
    await contact.screenshot({ path: path.join(OUTPUT, 'contact-sheet.png'), fullPage: true });
    report.status = 'passed'; report.browserErrors = errors;
    fs.writeFileSync(path.join(OUTPUT, 'qa-results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); await server.close(); }
}
