import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default async function verify({ page }) {
  const output = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../test-results/CoopAIFlow');
  await page.waitForFunction(() => !!window.coopAIFlow);
  const set = value => page.evaluate(index => window.coopAIFlow.setStep(index), value);
  const snap = () => page.evaluate(() => window.coopAIFlow.snapshot());
  for (let step = 0; step < 8; step++) {
    await set(step);
    assert.equal((await snap()).contact, false, `접촉 전 ${step}`);
    assert.equal(await page.locator('[data-door]').evaluate(el => el.classList.contains('open')), false);
    assert.ok(!(await page.locator('[data-speech]').innerText()).includes('밟고 있어'));
  }
  await set(5); assert.equal((await snap()).state, 'Accepted'); assert.equal((await snap()).cell, 1);
  await set(6); assert.equal((await snap()).state, 'Moving'); assert.equal((await snap()).cell, 2);
  await page.locator('[data-parallel]').check();
  assert.equal(await page.locator('[data-node="planner"]').evaluate(el => el.classList.contains('active')), true);
  await set(7); assert.equal((await snap()).state, 'Moving'); assert.equal((await snap()).cell, 4);
  await set(8); assert.equal((await snap()).state, 'Holding');
  const result = JSON.parse(await page.locator('[data-packet]').innerText());
  assert.equal(result.plate_contact, true); assert.equal(result.task_complete, false);
  assert.equal(await page.locator('[data-door]').evaluate(el => el.classList.contains('open')), true);
  await set(9);
  const reply = JSON.parse(await page.locator('[data-packet]').innerText());
  assert.equal(reply.type, 'session.commentary.append'); assert.equal(reply.delegation_id, 'item_demo');
  assert.match(await page.locator('[data-speech]').innerText(), /밟고 있어/);
  await page.locator('[data-parallel]').uncheck();
  assert.equal(await page.locator('[data-node="planner"]').evaluate(el => el.classList.contains('active')), false);
  await page.locator('[data-reset]').click();
  assert.equal((await snap()).step, 0);
  await page.locator('[data-play]').click();
  await page.waitForFunction(() => window.coopAIFlow.snapshot().step >= 2);
  await page.locator('[data-play]').click();
  assert.equal((await snap()).playing, false);
  await page.locator('[data-go-step="8"]').click(); assert.equal((await snap()).step, 8);
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('Home'); assert.equal((await snap()).step, 0);
  await page.keyboard.press('ArrowRight'); assert.equal((await snap()).step, 1);
  await page.keyboard.press('ArrowLeft'); assert.equal((await snap()).step, 0);
  await page.keyboard.press('End'); assert.equal((await snap()).step, 9);
  await page.keyboard.press('Space'); assert.equal((await snap()).playing, true);
  await page.keyboard.press('Space'); assert.equal((await snap()).playing, false);
  for (const width of [1280,1920]) {
    await page.setViewportSize({width, height:Math.round(width*9/16)});
    await page.evaluate(() => window.coopAIFlow.setParallel(true));
    for (let i = 0; i < 10; i++) {
      await set(i);
      const issues = await page.evaluate(() => {
        const slide = document.querySelector('.overview'), boundary = slide.getBoundingClientRect();
        return [...slide.querySelectorAll('h1,h2,p,pre,button,label,.node,.node-detail,.wire-label,.game,.event-strip,.playback,.state-track,.game-speech')].flatMap(el => {
          if (el.closest('.speaker-notes')) return [];
          const box = el.getBoundingClientRect(), style = getComputedStyle(el);
          if (!box.width || !box.height || style.display === 'none') return [];
          const out = box.left < boundary.left - 1 || box.right > boundary.right + 1 || box.top < boundary.top - 1 || box.bottom > boundary.bottom - 10;
          const spill = ['PRE','P','H1','H2','LABEL'].includes(el.tagName) && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2);
          return out || spill ? [el.className || el.textContent.slice(0,50)] : [];
        });
      });
      assert.deepEqual(issues, [], `stage ${i}, width ${width}`);
      if (width === 1280 && [0,3,6,8,9].includes(i)) {
        await page.waitForTimeout(780);
        await page.locator('.deck-stage').screenshot({path:path.join(output, `step-${i}.png`)});
      }
    }
  }
  await set(6);
  const before = await snap();
  await page.evaluate(() => window.ppt205Deck.preparePrint());
  const first = await page.locator('.overview').innerText();
  await page.evaluate(() => window.ppt205Deck.preparePrint());
  assert.equal(await page.locator('.overview').innerText(), first, 'Print must be idempotent');
  await page.evaluate(() => dispatchEvent(new Event('afterprint')));
  assert.equal((await snap()).step, before.step); assert.equal((await snap()).parallel, before.parallel);
  assert.equal((await snap()).printing, false); assert.equal((await snap()).playing, false);
  await page.evaluate(() => window.coopAIFlow.setParallel(false)); await set(0);
  console.log('CoopAIFlow: 지시·판단·실행·접촉·발화 순서, 병렬 계획, 재생·키보드·인쇄 복귀 통과');
}
