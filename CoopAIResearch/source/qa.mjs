import assert from 'node:assert/strict';
import path from 'node:path';

export default async function qa({ page }) {
  const output = path.resolve('test-results/CoopAIResearch');
  const states = () => page.evaluate(() => window.researchPage.states);
  await page.evaluate(() => window.ppt205Deck.go(0));
  assert.equal(await page.evaluate(() => window.researchPage.paused), false, 'Animations play without a click');
  const initial = (await states())[0].phase;
  await page.waitForFunction(value => window.researchPage.states[0].phase !== value, initial, { timeout: 6000 });
  await page.locator('#motion-toggle').click();
  assert.equal(await page.locator('#motion-toggle').getAttribute('aria-pressed'), 'true');
  const paused = await states();
  await page.waitForTimeout(500);
  assert.deepEqual(await states(), paused, 'Pause freezes all animation timelines');
  await page.locator('#motion-toggle').click();

  await page.evaluate(() => window.ppt205Deck.go(1));
  const departed = (await states())[0];
  await page.waitForTimeout(500);
  assert.deepEqual((await states())[0], departed, 'Offscreen animations stop');
  await page.waitForFunction(() => document.querySelector('[data-anim="puzzle"]').dataset.phase === '2', null, { timeout: 9000 });
  assert.equal(await page.locator('[data-anim="puzzle"] [data-task-state]').innerText(), '진행 중', 'Door opening alone does not finish the task');
  assert.match(await page.locator('[data-anim="puzzle"] [data-caption]').innerText(), /아직 통과 전/);
  await page.locator('#motion-toggle').click();
  await page.screenshot({ path: path.join(output, 'puzzle-holding.png') });

  await page.evaluate(() => window.ppt205Deck.go(9));
  assert.equal(await page.locator('.slide[aria-hidden="true"]').count(), 0, 'Reading mode exposes every chapter');
  assert.equal(await page.locator('.slide[inert]').count(), 0);
  await page.locator('[data-chapter="8"]').click();
  assert.equal(await page.evaluate(() => window.ppt205Deck.current), 8);
  assert.equal(await page.locator('[data-chapter="8"]').getAttribute('aria-current'), 'page');
  await page.evaluate(() => {
    const deck = window.ppt205Deck;
    deck.root.scrollTop = deck.slides[11].offsetTop + 15;
  });
  await page.waitForFunction(() => window.ppt205Deck.current === 11);
  await page.screenshot({ path: path.join(output, 'comparison-desktop.png') });

  const beforePrint = await states();
  await page.evaluate(() => { window.ppt205Deck.preparePrint(); window.ppt205Deck.preparePrint(); });
  assert.equal(await page.locator('.print-page').count(), 16, 'Print preparation is idempotent');
  assert.equal(await page.locator('[data-anim="puzzle"]').getAttribute('data-phase'), '4');
  assert.equal(await page.locator('[data-anim="matrix"] .matrix-cell.is-lit').count(), 4);
  const printed = await states();
  await page.waitForTimeout(500);
  assert.deepEqual(await states(), printed, 'PDF diagrams are static');
  await page.evaluate(() => dispatchEvent(new Event('afterprint')));
  assert.deepEqual(await states(), beforePrint, 'Print mode restores the reading state');
  assert.equal(await page.locator('.slide.is-active').count(), 1);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => window.researchPage.paused), true, 'Reduced motion is respected at startup');
  const reduced = await states();
  await page.waitForTimeout(500);
  assert.deepEqual(await states(), reduced);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (let index = 0; index < 16; index++) {
      await page.evaluate(value => window.ppt205Deck.go(value), index);
      const overflow = await page.evaluate(() => {
        const slide = document.querySelector('.slide.is-active');
        const rect = slide.getBoundingClientRect();
        const root = document.querySelector('.deck-stage');
        const bad = [...slide.querySelectorAll('*')].filter(el => {
          if (el.closest('.speaker-notes') || el instanceof SVGElement) return false;
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return r.width && r.height && style.display !== 'none' && style.visibility !== 'hidden' && (r.left < rect.left - 2 || r.right > rect.right + 2 || r.bottom > rect.bottom + 2);
        }).map(el => el.className || el.tagName);
        return { root: root.scrollWidth > root.clientWidth + 1, bad };
      });
      assert.deepEqual(overflow, { root: false, bad: [] }, `No overflow at ${width}px, chapter ${index + 1}`);
    }
    await page.evaluate(() => window.ppt205Deck.go(0));
    await page.screenshot({ path: path.join(output, `mobile-${width}.png`) });
  }
  await page.locator('#menu-toggle').click();
  assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'true');
  await page.locator('[data-chapter="11"]').click();
  assert.equal(await page.evaluate(() => window.ppt205Deck.current), 11);
  assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'false');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => window.ppt205Deck.go(0));
}
