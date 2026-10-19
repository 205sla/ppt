import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sections = JSON.parse(fs.readFileSync(new URL('script.json', import.meta.url), 'utf8'));
const expected = sections.flatMap((section) => section.sentences);
const output = fileURLToPath(new URL('../../test-results/EntryHarnessScript/', import.meta.url));

export default async function verify({ page, baseUrl, deck }) {
    assert.deepEqual(await page.locator('.reading-sentence').allTextContents(), expected);
    assert.deepEqual(await page.locator('.slide').evaluateAll((slides) => [...new Set(slides.map((slide) => slide.dataset.scene))]), ['S01', 'S08', 'S09']);
    for (const [scene, index] of [['S01', 0], ['S08', 4], ['S09', 8]]) {
        await page.locator(`[data-scene-target="${scene}"]`).click();
        assert.equal(await page.evaluate(() => window.ppt205Deck.current), index);
        assert.equal(await page.locator(`[data-scene-target="${scene}"]`).getAttribute('aria-current'), 'true');
        await page.keyboard.press('ArrowRight');
        assert.equal(await page.evaluate(() => window.ppt205Deck.current), index + 1, '구간 버튼을 누른 뒤 키보드 이동');
    }
    await page.locator('[data-deck-previous]').click();
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => window.ppt205Deck.current), 9, '이전 문장 버튼을 누른 뒤 Space 이동');

    await page.locator('[data-reader-fullscreen]').click();
    await page.waitForFunction(() => document.fullscreenElement !== null);
    await page.keyboard.press('KeyF');
    await page.waitForFunction(() => document.fullscreenElement === null);

    for (const viewport of [{ width: 3840, height: 2160 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        for (let index = 0; index < expected.length; index += 1) {
            await page.evaluate((target) => window.ppt205Deck.go(target), index);
            const layout = await page.locator('.slide.is-active').evaluate((slide) => {
                const sentence = slide.querySelector('.reading-sentence');
                const box = sentence.getBoundingClientRect();
                const area = slide.querySelector('.reading-area').getBoundingClientRect();
                const label = slide.querySelector('.scene-label').getBoundingClientRect();
                const position = slide.querySelector('.scene-position').getBoundingClientRect();
                return {
                    fits: box.left >= area.left - 1 && box.right <= area.right + 1 && box.top >= area.top - 1 && box.bottom <= area.bottom + 1,
                    noOverlap: box.top > label.bottom && box.bottom < position.top,
                    font: parseFloat(getComputedStyle(sentence).fontSize),
                    overflow: document.documentElement.scrollWidth > innerWidth,
                };
            });
            assert.ok(layout.fits && layout.noOverlap && !layout.overflow, `${viewport.width}px, ${index + 1}번 문장 읽기 영역`);
            assert.ok(layout.font >= (viewport.width > 700 ? 90 : 26), '읽기 글자 크기');
        }
        await page.evaluate(() => window.ppt205Deck.go(2));
        await page.screenshot({ path: path.join(output, `reading-${viewport.width}.png`) });
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${baseUrl}/${deck.slug}/#/5`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.ppt205Deck?.current === 4);
    assert.equal(await page.locator('[data-scene-target="S08"]').getAttribute('aria-current'), 'true');
    await page.keyboard.press('End');
    assert.equal(await page.evaluate(() => window.ppt205Deck.current), expected.length - 1);
    await page.keyboard.press('Home');
    assert.equal(await page.evaluate(() => window.ppt205Deck.current), 0);
}
