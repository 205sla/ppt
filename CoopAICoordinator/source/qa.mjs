import assert from 'node:assert/strict';

export default async function qa({ page }) {
    const state = async (kind) => page.locator(`#${kind}-slide`).getAttribute(`data-${kind}-state`);
    await page.evaluate(() => window.ppt205Deck.go(1));
    await page.locator('[data-sequence="reset"]').click();
    for (let index = 1; index <= 5; index += 1) await page.locator('[data-sequence="next"]').click();
    assert.equal(await state('sequence'), '5', 'All six diagram steps are reachable');
    assert.match(await page.locator('[data-sequence-caption]').innerText(), /재관측/);
    await page.locator('[data-sequence="play"]').click();
    await page.waitForFunction(() => document.querySelector('#sequence-slide').dataset.sequenceState === '1');
    await page.evaluate(() => window.ppt205Deck.go(2));
    const paused = await state('sequence');
    await page.waitForTimeout(1700);
    assert.equal(await state('sequence'), paused, 'Autoplay stops when leaving the diagram');

    await page.evaluate(() => window.ppt205Deck.go(3));
    await page.locator('[data-puzzle="reset"]').click();
    await page.locator('[data-puzzle="next"]').click();
    await page.locator('[data-puzzle="next"]').click();
    assert.equal(await state('puzzle'), '2');
    assert.equal(await page.locator('[data-puzzle-phase]').innerText(), '발판 유지');
    assert.match(await page.locator('[data-puzzle-caption]').innerText(), /아직 통과 전/);
    await page.locator('[data-puzzle="next"]').click();
    assert.equal(await page.locator('[data-puzzle-phase]').innerText(), '통과 대기');
    await page.locator('[data-puzzle="next"]').click();
    assert.equal(await page.locator('[data-puzzle-phase]').innerText(), '완료');
    assert.match(await page.locator('[data-puzzle-caption]').innerText(), /함께 확인/);
    await page.locator('[data-puzzle="reset"]').click();
    await page.locator('[data-puzzle="next"]').click();
    const beforePrint = { sequence:await state('sequence'), puzzle:await state('puzzle') };
    await page.evaluate(() => { window.ppt205Deck.preparePrint(); window.ppt205Deck.preparePrint(); });
    assert.equal(await state('puzzle'), '3', 'PDF uses the waiting-for-player scene');
    assert(await page.locator('.sequence-chart').evaluate((el) => el.classList.contains('all-steps')));
    await page.evaluate(() => dispatchEvent(new Event('afterprint')));
    assert.equal(await state('sequence'), beforePrint.sequence, 'Diagram restores after repeated print prep');
    assert.equal(await state('puzzle'), beforePrint.puzzle, 'Puzzle restores after repeated print prep');
    assert.equal(await page.locator('[data-puzzle="play"]').getAttribute('aria-pressed'), 'false');
    await page.evaluate(() => window.ppt205Deck.go(0));
}
