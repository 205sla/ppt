import assert from 'node:assert/strict';

export default async function verify({ page, baseUrl, deck }) {
    await page.waitForFunction(() => !!window.aiGuideDeck);
    const visit = (selector) => page.evaluate((value) => {
        const slide = document.querySelector(value);
        window.ppt205Deck.go(window.ppt205Deck.slides.indexOf(slide));
    }, selector);
    const snapshot = () => page.evaluate(() => window.aiGuideDeck.snapshot());
    const step = (name, frame) => page.evaluate(({ name, frame }) => window.aiGuideDeck.setStep(name, frame), { name, frame });

    // 자동 재생은 해당 슬라이드에서만 돌고, 이동하면 멈춰야 합니다.
    await visit('[data-demo="nextchar"]');
    assert.deepEqual((await snapshot()).playing, ['nextchar']);
    await visit('[data-demo="stack"]');
    assert.deepEqual((await snapshot()).playing, ['stack'], '이전 슬라이드 재생 중지');

    // 단계 버튼
    await visit('[data-demo="compact"]');
    await page.locator('[data-demo="compact"] [data-replay]').click();
    await page.locator('[data-demo="compact"] [data-forward]').click();
    assert.equal((await snapshot()).frames.compact, 1);
    assert.deepEqual((await snapshot()).playing, [], '단계 이동 시 자동 재생 중지');
    assert.notEqual(await page.evaluate(() => document.activeElement?.tagName), 'BUTTON', '클릭 후 방향키로 슬라이드 이동 가능');

    // 수동 모드(A): 자동 재생 없이 → ← 키가 장면 단계를 먼저 넘기고, 끝에서만 슬라이드를 넘깁니다.
    const current = () => page.evaluate(() => window.ppt205Deck.current);
    await page.keyboard.press('a');
    assert.equal((await snapshot()).manual, true);
    await visit('[data-demo="reasoning"]');
    assert.equal((await snapshot()).frames.reasoning, 3, '뒤로 이동한 장면은 마지막 단계부터');
    await visit('[data-demo="stack"]');
    const stackIndex = await current();
    assert.deepEqual((await snapshot()).playing, [], '수동 모드에서는 자동 재생 안 함');
    assert.equal((await snapshot()).frames.stack, 0);
    await page.keyboard.press('ArrowRight');
    assert.equal((await snapshot()).frames.stack, 1, '→ 키로 장면 단계 이동');
    assert.equal(await current(), stackIndex, '장면 단계가 남아 있으면 슬라이드 유지');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await current(), stackIndex - 1, '첫 단계에서 ← 키는 이전 슬라이드로');
    await visit('[data-demo="stack"]');
    await step('stack', 5);
    await page.keyboard.press('ArrowRight');
    assert.equal(await current(), stackIndex + 1, '마지막 단계에서 → 키는 다음 슬라이드로');
    assert.equal((await snapshot()).frames.cache, 0);
    await page.keyboard.press('ArrowLeft');
    assert.equal(await current(), stackIndex);
    assert.equal((await snapshot()).frames.stack, 5, '뒤로 돌아오면 마지막 단계부터');
    await page.keyboard.press('a');
    assert.equal((await snapshot()).manual, false);
    assert.deepEqual((await snapshot()).playing, ['stack'], '수동 모드를 끄면 다시 자동 재생');

    // 질문할 때마다 보내는 카드: 2n-1장, 누적은 n²칸
    for (const [frame, sent, total] of [[0, 1, 1], [1, 3, 4], [3, 7, 16], [5, 15, 64]]) {
        await step('stack', frame);
        assert.equal(await page.locator('[data-now]').innerText(), String(sent));
        assert.equal(await page.locator('[data-total]').innerText(), String(total));
        assert.equal(await page.locator('.st-cell.on').count(), total, `stack ${frame}단계 칸 수`);
        assert.equal(await page.locator('.st-cell.now').count(), sent, `stack ${frame}단계 이번 카드 칸 수`);
    }

    // 캐시: 바로 이어서 < 처음 < 한참 뒤
    await step('cache', 4);
    const units = await page.locator('[data-cache-bars] .ca-bar').evaluateAll((bars) => bars.map((bar) => Number(bar.dataset.units)));
    assert.ok(units[1] < units[0] && units[0] < units[2], `캐시 막대 순서 ${units}`);
    assert.equal(await page.locator('[data-cache-cards] .ca-card.calc').count(), 7);
    await step('cache', 1);
    assert.equal(await page.locator('[data-cache-cards] .ca-card.saved').count(), 4);

    // 모든 단계에서 내용이 슬라이드 밖으로 넘치지 않는지 확인합니다.
    const demos = await page.evaluate(() => [...window.aiGuideDeck.demos].map(([name, demo]) => ({ name, steps: demo.steps, print: demo.printFrame })));
    for (const width of [1280, 1920]) {
        await page.setViewportSize({ width, height: Math.round(width * 9 / 16) });
        for (const demo of demos) {
            await visit(`[data-demo="${demo.name}"]`);
            for (let frame = 0; frame < demo.steps; frame += 1) {
                await step(demo.name, frame);
                await page.waitForTimeout(40);
                const overflow = await page.evaluate(() => {
                    const slide = document.querySelector('.slide.is-active');
                    const bounds = slide.getBoundingClientRect();
                    return [...slide.querySelectorAll('h2, h3, p, li, span, button, table, td')].flatMap((element) => {
                        if (element.closest('.speaker-notes, .off')) return [];
                        const box = element.getBoundingClientRect();
                        const style = getComputedStyle(element);
                        if (!box.width || !box.height || style.visibility === 'hidden' || Number(style.opacity) === 0) return [];
                        return box.bottom > bounds.bottom - 4 || box.right > bounds.right + 1 || box.left < bounds.left - 1 || box.top < bounds.top - 1
                            ? [element.textContent.trim().slice(0, 40)] : [];
                    });
                });
                assert.deepEqual(overflow, [], `${demo.name} ${frame + 1}단계 ${width}px: 내용 넘침`);
            }
        }
    }

    // 유튜브 자막 영역: 모든 쪽과 단계에서 하단 30%에는 내용이 없어야 합니다.
    // 꼬리말·쪽 번호·단계 버튼·조작 안내는 내용이 아니므로 제외합니다.
    const still = await page.addStyleTag({ content: '.slide, .slide * { animation: none !important; transition: none !important; }' });
    const slideCount = await page.evaluate(() => window.ppt205Deck.slides.length);
    for (const width of [1280, 1920]) {
        await page.setViewportSize({ width, height: Math.round(width * 9 / 16) });
        for (let index = 0; index < slideCount; index += 1) {
            const name = await page.evaluate((i) => { window.ppt205Deck.go(i); return window.ppt205Deck.slides[i].dataset.demo || null; }, index);
            const steps = name ? demos.find((demo) => demo.name === name).steps : 1;
            for (let frame = 0; frame < steps; frame += 1) {
                if (name) await step(name, frame);
                const issues = await page.evaluate(() => {
                    const slide = document.querySelector('.slide.is-active');
                    const bounds = slide.getBoundingClientRect();
                    const limit = bounds.top + bounds.height * 0.7;
                    return [...slide.querySelectorAll('*')].flatMap((element) => {
                        if (element.closest('.slide-footer, .slide-number, .demo-controls, .speaker-notes, .help, .off')) return [];
                        const box = element.getBoundingClientRect();
                        const style = getComputedStyle(element);
                        if (!box.width || !box.height || style.visibility === 'hidden' || Number(style.opacity) === 0) return [];
                        return box.bottom > limit + 1 ? [`${element.tagName}.${element.className} +${Math.round(box.bottom - limit)}px`] : [];
                    });
                });
                assert.deepEqual(issues, [], `${index + 1}쪽 ${frame + 1}단계 ${width}px: 자막 영역(하단 30%)에 내용이 있음`);
            }
        }
    }
    await still.evaluate((element) => element.remove());

    // PDF 준비는 반복해도 같은 장면이어야 하고, 끝나면 원래 화면으로 돌아와야 합니다.
    await page.evaluate(() => window.ppt205Deck.preparePrint());
    const once = await snapshot();
    await page.evaluate(() => window.ppt205Deck.preparePrint());
    assert.deepEqual(await snapshot(), once, '인쇄 준비 반복 안정성');
    assert.deepEqual(once.playing, []);
    for (const demo of demos) assert.equal(once.frames[demo.name], demo.print, `${demo.name} 인쇄 장면`);
    // 대화 재전송 장면은 '두 배 → 네 배' 자막이 남는 단계로 인쇄합니다.
    assert.equal(once.frames.stack, 4);
    // 인쇄 장면: 압축 뒤 조건 카드는 기억 공간 밖에 있어야 합니다.
    const [sticky, box] = await page.evaluate(() => ['.cp-sticky', '.cp-box'].map((s) => document.querySelector(s).getBoundingClientRect().toJSON()));
    assert.ok(sticky.left > box.right, '인쇄 장면에서 조건 카드가 기억 공간 밖으로 빠짐');
    await page.evaluate(() => dispatchEvent(new Event('afterprint')));
    assert.equal((await snapshot()).printing, false);

    const pdf = await page.request.get(`${baseUrl}/${deck.slug}/downloads/${deck.slug}.pdf`);
    assert.ok(pdf.ok());
    console.log(`${deck.slug}: 자동 재생·단계 버튼·수동 모드·제곱 칸 수·캐시 막대·단계별 넘침·자막 영역 비움·인쇄 복귀 검증 통과`);
}
