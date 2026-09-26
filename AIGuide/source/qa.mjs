import assert from 'node:assert/strict';

export default async function verify({ page, baseUrl, deck }) {
    await page.waitForFunction(() => !!window.aiGuideDeck);
    const visit = (selector) => page.evaluate((value) => {
        const slide = document.querySelector(value);
        window.ppt205Deck.go(window.ppt205Deck.slides.indexOf(slide));
    }, selector);

    // 자동 재생은 해당 슬라이드에서만 돌고, 이동하면 멈춰야 합니다.
    await visit('[data-demo="nextchar"]');
    assert.deepEqual((await page.evaluate(() => window.aiGuideDeck.snapshot())).playing, ['nextchar']);
    await visit('[data-demo="resend"]');
    assert.deepEqual((await page.evaluate(() => window.aiGuideDeck.snapshot())).playing, ['resend'], '이전 슬라이드 재생 중지');

    // 단계 버튼
    await visit('[data-demo="compact"]');
    await page.locator('[data-demo="compact"] [data-replay]').click();
    await page.locator('[data-demo="compact"] [data-forward]').click();
    assert.equal((await page.evaluate(() => window.aiGuideDeck.snapshot())).frames.compact, 1);
    assert.deepEqual((await page.evaluate(() => window.aiGuideDeck.snapshot())).playing, [], '단계 이동 시 자동 재생 중지');
    assert.notEqual(await page.evaluate(() => document.activeElement?.tagName), 'BUTTON', '클릭 후 방향키로 슬라이드 이동 가능');

    // 제곱 그래프: 누적 사용량 계산
    await visit('[data-chart="square"]');
    await page.evaluate(() => window.aiGuideDeck.setTurns(20));
    assert.equal(await page.locator('[data-total]').innerText(), '210');
    assert.equal(await page.locator('[data-double]').innerText(), '820');
    assert.equal(await page.locator('[data-chart="square"] .bar:not(.empty)').count(), 20);
    await page.evaluate(() => window.aiGuideDeck.setTurns(10));
    assert.equal(await page.locator('[data-total]').innerText(), '55');
    assert.equal(await page.locator('[data-ratio]').innerText(), '약 3.8배');

    // 모든 단계에서 내용이 슬라이드 밖으로 넘치지 않는지 확인합니다.
    const demos = await page.evaluate(() => [...window.aiGuideDeck.demos].map(([name, demo]) => ({ name, steps: demo.steps })));
    for (const width of [1280, 1920]) {
        await page.setViewportSize({ width, height: Math.round(width * 9 / 16) });
        for (const demo of demos) {
            await visit(`[data-demo="${demo.name}"]`);
            for (let frame = 0; frame < demo.steps; frame += 1) {
                await page.evaluate(({ name, frame }) => window.aiGuideDeck.setStep(name, frame), { name: demo.name, frame });
                await page.waitForTimeout(40);
                const overflow = await page.evaluate(() => {
                    const slide = document.querySelector('.slide.is-active');
                    const bounds = slide.getBoundingClientRect();
                    return [...slide.querySelectorAll('h2, h3, p, li, span, button, table, td')].flatMap((element) => {
                        if (element.closest('.speaker-notes, .off')) return [];
                        const box = element.getBoundingClientRect();
                        if (!box.width || !box.height) return [];
                        return box.bottom > bounds.bottom - 4 || box.right > bounds.right + 1 || box.left < bounds.left - 1 || box.top < bounds.top - 1
                            ? [element.textContent.trim().slice(0, 40)] : [];
                    });
                });
                assert.deepEqual(overflow, [], `${demo.name} ${frame + 1}단계 ${width}px: 내용 넘침`);
            }
        }
    }

    // PDF 준비는 반복해도 같은 장면이어야 하고, 끝나면 원래 화면으로 돌아와야 합니다.
    await page.evaluate(() => window.ppt205Deck.preparePrint());
    const once = await page.evaluate(() => window.aiGuideDeck.snapshot());
    await page.evaluate(() => window.ppt205Deck.preparePrint());
    const twice = await page.evaluate(() => window.aiGuideDeck.snapshot());
    assert.deepEqual(twice, once, '인쇄 준비 반복 안정성');
    assert.deepEqual(once.playing, []);
    for (const demo of demos) assert.equal(once.frames[demo.name], demo.steps - 1, `${demo.name} 인쇄 장면`);
    assert.equal(once.turns, 10);
    await page.evaluate(() => dispatchEvent(new Event('afterprint')));
    assert.equal((await page.evaluate(() => window.aiGuideDeck.snapshot())).printing, false);

    const pdf = await page.request.get(`${baseUrl}/${deck.slug}/downloads/${deck.slug}.pdf`);
    assert.ok(pdf.ok());
    console.log(`${deck.slug}: 자동 재생·단계 버튼·제곱 계산·단계별 넘침·인쇄 복귀 검증 통과`);
}
