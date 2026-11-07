import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 엔트리 하네스 웹 발표 전용 검사.
// 발표자가 직접 넘기는 자료인지(자동 전환·타이머 없음), 장면 단계가 슬라이드 이동과 섞이지 않고
// 되돌아가기·다시 재생이 예측 가능한지, 다룰 범위와 사실 표시, 화면 크기별 배치, 움직임 줄이기, 인쇄 상태를 확인합니다.
const here = path.dirname(fileURLToPath(import.meta.url));
const glyphs = new Set(JSON.parse(fs.readFileSync(path.join(here, 'font-glyphs.json'), 'utf8')).chars);
const STEPS = ['명세 작성', '정적 검사', '작품 생성', '실행·관찰', '작품별 검사', '피드백'];
const STEP_SLIDES = ['① 명세 작성', '② 정적 검사', '③ 작품 생성', '④ 실행·관찰', '⑤ 작품별 검사', '⑥ 피드백'];
const STILL = '*, *::before, *::after { transition-duration: 0s !important; transition-delay: 0s !important; animation-duration: 0s !important; animation-delay: 0s !important; }';

export default async function verify({ page, baseUrl, deck }) {
    const p = await page.context().browser().newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [];
    p.on('pageerror', (error) => errors.push(error.message));
    // 자료 스크립트(공통·전용 deck.js)가 타이머나 rAF를 쓰는지 셉니다. 자동 진행이 없어야 합니다.
    await p.addInitScript(() => {
        const counts = { timeout: 0, interval: 0, raf: 0 };
        window.__deckTimers = counts;
        for (const [name, key] of [['setTimeout', 'timeout'], ['setInterval', 'interval'], ['requestAnimationFrame', 'raf']]) {
            const original = window[name];
            window[name] = function (...args) {
                if (/\/(EntryHarnessFlow|shared)\/deck\.js/.test(new Error().stack || '')) counts[key] += 1;
                return original.apply(this, args);
            };
        }
    });
    try {
        await p.goto(`${baseUrl}/${deck.slug}/`, { waitUntil: 'networkidle' });
        await p.waitForFunction(() => window.entryHarnessFlow && window.ppt205Deck);
        await p.evaluate(() => document.fonts.ready);

        const count = await p.evaluate(() => window.ppt205Deck.slides.length);
        const scenes = await p.evaluate(() => window.entryHarnessFlow.scenes());
        const scene = (name) => scenes.find((item) => item.name === name);
        const state = () => p.evaluate(() => window.entryHarnessFlow.state());
        const current = async () => (await state()).current;
        const step = async (name) => (await state()).steps[name];
        const go = (index) => p.evaluate((i) => window.ppt205Deck.go(i), index);
        const enterForward = async (name) => { await go(scene(name).index - 1); await p.keyboard.press('ArrowRight'); };
        const shown = (selector) => p.evaluate((s) => {
            const el = document.querySelector('.slide.is-active ' + s);
            return !!el && el.checkVisibility({ opacityProperty: true, visibilityProperty: true, checkOpacity: true, checkVisibilityCSS: true });
        }, selector);
        const status = () => p.locator('.slide.is-active .step-status').innerText();

        // ── 범위: 완성 작품·편집기 장, 게임 실행, 영상·iframe 없이 하네스 원리만 다룹니다. ──
        assert.equal(await p.locator('.deck-stage iframe, .deck-stage video, .deck-stage audio, .deck-stage embed, .deck-stage object, .deck-stage canvas, .deck-stage img').count(), 0, '영상·게임·편집기 화면을 넣지 않음');
        assert.equal(await p.locator('a[href*="playentry"]').count(), 0, '완성작 플레이 링크 없음');
        const titles = await p.evaluate(() => window.ppt205Deck.slides.map((slide) => slide.dataset.title));
        assert.ok(!titles.some((title) => /완성 작품|편집기에서/.test(title)), '완성 작품·편집기 장 제외');
        const first = titles.indexOf(STEP_SLIDES[0]);
        assert.deepEqual(titles.slice(first, first + 6), STEP_SLIDES, '명세 작성 → 정적 검사(생성 전) → 작품 생성 → 실행·관찰 → 작품별 검사 → 피드백 순서');
        assert.ok(titles.indexOf('요청') < titles.indexOf('역할 나누기') && titles.indexOf('역할 나누기') < first && first + 6 <= titles.indexOf('실제 제작 기록'), '요청 → 역할 → 6단계 → 실제 기록');
        const pipeline = await p.locator('.overview .st h3').allInnerTexts();
        assert.deepEqual(pipeline, STEPS, '6단계 한눈에 보기 순서');
        for (const rail of await p.locator('.rail').all()) assert.deepEqual((await rail.locator('li').allInnerTexts()).map((text) => text.replace(/^\d\s*/, '')), STEPS, '진행 표시 순서');
        // 66/66은 반드시 당시 보관 기록이라는 표시와 함께 나옵니다.
        const tally = await p.locator('.tally').innerText();
        for (const fact of ['66 / 66', '2026-09-23', 'sunset-drive_002.ent', 'Entry 4.0.20', 'Chromium', '새로 실행한 검사가 아닙니다']) assert.ok(tally.includes(fact), '66/66 출처 표시: ' + fact);
        assert.ok((await p.locator('.request .chat-head').innerText()).includes('설명용 예문'), '시작 문장은 설명용 예문으로 표시');
        assert.ok((await p.locator('.real-req').innerText()).includes('실제 플레이 검증까지'), '실제 요청은 더 자세했다는 근거');

        // ── 발표자 노트: 모든 장에 발표용 문장 ──
        const notes = await p.evaluate(() => window.ppt205Deck.slides.map((slide) => [...slide.querySelectorAll('.speaker-notes p')].map((para) => para.textContent.trim())));
        notes.forEach((paras, index) => {
            assert.ok(paras.length >= 2 && paras.join(' ').length >= 120, `${index + 1}쪽 발표자 노트가 너무 짧음`);
            assert.ok(!/TODO|FIXME|placeholder|deck\.js|qa\.mjs|data-|세션|프롬프트|위임/i.test(paras.join(' ')), `${index + 1}쪽 노트에 제작용 문구`);
        });

        // ── 자동 진행 없음: 그대로 두어도 슬라이드·단계가 바뀌지 않습니다. ──
        await p.evaluate(() => { window.__deckTimers.timeout = 0; window.__deckTimers.interval = 0; window.__deckTimers.raf = 0; });
        await go(0);
        await p.waitForTimeout(3000);
        assert.equal(await current(), 0, '표지에서 자동 전환 없음');
        await enterForward('request');
        await p.waitForTimeout(3000);
        assert.equal(await current(), scene('request').index, '요청 장에서 자동 전환 없음');
        assert.equal(await step('request'), 0, '장면 단계 자동 진행 없음');
        assert.equal(await p.evaluate(() => [...document.querySelectorAll('.slide.is-active .typed .ch')].every((ch) => getComputedStyle(ch).opacity === '1')), true, '타자 효과는 CSS로 끝까지 표시');

        // ── 숨겨진 장의 움직임 정리 ──
        await enterForward('roles');
        await p.locator('.slide.is-active [data-step-next]').click();
        assert.ok(await p.evaluate(() => document.querySelector('.slide.is-active').getAnimations({ subtree: true }).some((a) => a.effect.getTiming().iterations === Infinity && a.playState === 'running')), '흐름 표시가 현재 장에서 움직임');
        await enterForward('obs');
        await p.locator('.slide.is-active [data-step-next]').click();
        await p.locator('.slide.is-active [data-step-next]').click();
        assert.ok(await p.evaluate(() => document.querySelector('.slide.is-active').getAnimations({ subtree: true }).some((a) => a.playState === 'running')), '키 입력 장면이 움직임');
        await go(count - 1);
        assert.deepEqual(await p.evaluate(() => document.getAnimations()
            .filter((a) => a.playState === 'running' && a.effect?.target?.closest?.('.slide') && !a.effect.target.closest('.slide.is-active'))
            .map((a) => a.effect.target.className)), [], '다른 장의 애니메이션이 계속 돌지 않음');
        assert.equal(await p.evaluate(() => document.querySelector('[data-scene="roles"]').getAnimations({ subtree: true }).length), 0, '떠난 장의 반복 애니메이션 정리');

        // ── 다시 재생: 0단계로 돌아가 타자 효과부터 다시 ──
        await enterForward('request');
        await p.locator('.slide.is-active [data-step-next]').click();
        await p.locator('.slide.is-active [data-step-next]').click();
        assert.equal(await step('request'), 2);
        await p.locator('.slide.is-active [data-step-replay]').click();
        assert.equal(await step('request'), 0, '다시 재생은 0단계부터');
        assert.equal(await p.evaluate(() => getComputedStyle([...document.querySelectorAll('.slide.is-active .typed .ch')].at(-1)).opacity), '0', '다시 재생 직후 타자 효과가 처음부터');
        await p.waitForTimeout(2600);
        assert.equal(await p.evaluate(() => getComputedStyle([...document.querySelectorAll('.slide.is-active .typed .ch')].at(-1)).opacity), '1', '다시 재생한 타자 효과가 끝남');

        const still = await p.addStyleTag({ content: STILL });

        // ── 슬라이드 이동(공통 키·버튼)과 노트 ──
        await go(0);
        for (let index = 1; index < count; index += 1) {
            await p.keyboard.press('ArrowRight');
            assert.equal(await current(), index, `→ 키로 ${index + 1}쪽 이동`);
        }
        await p.keyboard.press('ArrowRight');
        assert.equal(await current(), count - 1, '마지막 장에서 더 넘어가지 않음');
        await p.keyboard.press('Home');
        assert.equal(await current(), 0);
        await p.locator('[data-deck-next]').click();
        assert.equal(await current(), 1, '다음 버튼');
        await p.locator('[data-deck-previous]').click();
        assert.equal(await current(), 0, '이전 버튼');
        await p.keyboard.press('End');
        assert.equal(await current(), count - 1);
        await p.keyboard.press('KeyN');
        const noteText = () => p.evaluate(() => [document.querySelector('[data-deck-notes]').innerText.replace(/\s+/g, ' ').trim(), document.querySelector('.slide.is-active .speaker-notes').textContent.replace(/\s+/g, ' ').trim()]);
        let [panel, source] = await noteText();
        assert.equal(panel, source, 'N 키 발표자 노트가 현재 장과 일치');
        await p.keyboard.press('ArrowLeft');
        [panel, source] = await noteText();
        assert.equal(panel, source, '장을 넘기면 노트도 바뀜');
        await p.keyboard.press('KeyN');
        assert.equal(await p.evaluate(() => document.body.classList.contains('show-notes')), false);

        // ── 장면 단계: 단계 버튼과 ↓ ↑ 키는 슬라이드를 넘기지 않습니다. ──
        for (const item of scenes) {
            await enterForward(item.name);
            assert.equal(await step(item.name), 0, `${item.name}: 앞에서 들어오면 0단계`);
            assert.equal(await status(), `1 / ${item.steps}\n${item.labels[0]}`, `${item.name}: 단계 표시`);
            assert.equal(await p.locator('.slide.is-active [data-step-prev]').isDisabled(), true);
            for (let k = 1; k < item.steps; k += 1) {
                await p.locator('.slide.is-active [data-step-next]').click();
                assert.equal(await step(item.name), k, `${item.name}: ${k + 1}단계`);
                assert.equal(await status(), `${k + 1} / ${item.steps}\n${item.labels[k]}`);
            }
            assert.equal(await p.locator('.slide.is-active [data-step-next]').isDisabled(), true, `${item.name}: 마지막 단계에서 다음 버튼 비활성`);
            await p.keyboard.press('ArrowDown');
            assert.equal(await step(item.name), item.steps - 1, `${item.name}: 마지막 단계 유지`);
            await p.keyboard.press('ArrowUp');
            assert.equal(await step(item.name), item.steps - 2, `${item.name}: ↑ 키로 이전 단계`);
            assert.equal(await current(), item.index, `${item.name}: 단계 조작 중 슬라이드 유지`);
            await p.keyboard.press('ArrowDown');
            // 마우스로 누른 단계 버튼이 포커스를 잡지 않아 → 키가 바로 다음 장으로 넘어갑니다.
            assert.notEqual(await p.evaluate(() => document.activeElement?.tagName), 'BUTTON', `${item.name}: 버튼 클릭 뒤 포커스 해제`);
            await p.keyboard.press('ArrowRight');
            assert.equal(await current(), item.index + 1, `${item.name}: 단계 조작 뒤 → 키로 다음 장`);
            await p.keyboard.press('ArrowLeft');
            assert.equal(await current(), item.index);
            assert.equal(await step(item.name), item.steps - 1, `${item.name}: 뒤에서 돌아오면 완성 단계`);
        }
        // 키보드 사용자는 단계 버튼에 포커스를 유지한 채 Enter로 넘길 수 있습니다.
        await enterForward('roles');
        await p.locator('.slide.is-active [data-step-next]').focus();
        await p.keyboard.press('Enter');
        assert.equal(await step('roles'), 1);
        assert.equal(await p.evaluate(() => document.activeElement?.hasAttribute('data-step-next')), true, '키보드로 누른 버튼은 포커스 유지');
        await p.keyboard.press('ArrowDown');
        assert.equal(await step('roles'), 2, '포커스가 버튼에 있어도 ↓ 키로 단계 이동');
        await p.evaluate(() => document.activeElement?.blur());

        // ── 단계가 보여 주는 내용 ──
        await enterForward('request');
        assert.equal(await shown('.typed'), true);
        assert.equal(await shown('.real-req'), false, '0단계에는 예문만');
        await p.evaluate(() => window.entryHarnessFlow.setStep('request', 2));
        assert.equal(await shown('.real-req'), true, '3단계에 실제 요청');
        assert.ok(await p.evaluate(() => document.querySelector('.slide.is-active .chat').getBoundingClientRect().right < document.querySelector('.slide.is-active .real-req').getBoundingClientRect().left), '예문 창이 비켜서 실제 요청과 나란히');
        await enterForward('overview');
        for (let k = 1; k <= 6; k += 1) {
            await p.locator('.slide.is-active [data-step-next]').click();
            assert.deepEqual(await p.locator('.slide.is-active .st.is-now h3').allInnerTexts(), [STEPS[k - 1]], `한눈에 보기 ${k}단계 강조`);
            assert.equal(await p.evaluate(() => [...document.querySelectorAll('.slide.is-active .st-out')].filter((el) => el.checkVisibility({ opacityProperty: true, visibilityProperty: true, checkOpacity: true, checkVisibilityCSS: true })).length), k, `${k}단계까지 넘긴 것 표시`);
        }
        assert.equal(await shown('.pipe-loop'), false);
        await p.locator('.slide.is-active [data-step-next]').click();
        assert.equal(await shown('.pipe-loop'), true, '마지막에 ①로 돌아가는 고리');
        await enterForward('spec');
        await p.locator('.slide.is-active .behavior.brake').click();
        assert.equal(await step('spec'), 2, '동작 버튼으로 바로 선택');
        assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('.slide.is-active .ln')].filter((ln) => getComputedStyle(ln).boxShadow !== 'none').map((ln) => ln.dataset.n)), ['287'], '브레이크 줄만 강조');
        await enterForward('verify');
        assert.equal(await shown('.got'), false, '기대값 먼저');
        await p.locator('.slide.is-active [data-step-next]').click();
        assert.equal(await shown('.got'), true);
        assert.equal(await shown('.tally'), false, '집계는 비교 뒤');
        await enterForward('feedback');
        assert.equal(await shown('.good'), false, '처음에는 오류 상태');
        await p.evaluate(() => window.entryHarnessFlow.setStep('feedback', 4));
        assert.equal(await shown('.good'), true, '다시 확인 뒤 정상 표시');
        await enterForward('log');
        await p.evaluate(() => window.entryHarnessFlow.setStep('log', 3));
        assert.deepEqual(await p.locator('.slide.is-active .rail li.hit .n').allInnerTexts(), ['4', '6'], '실제 기록이 6단계 중 어디인지 표시');

        // ── 화면 크기별 배치: 모든 장·모든 단계 ──
        const layout = () => p.evaluate(() => {
            const slide = document.querySelector('.slide.is-active');
            const bounds = slide.getBoundingClientRect();
            const visible = (el) => el.checkVisibility({ opacityProperty: true, visibilityProperty: true, checkOpacity: true, checkVisibilityCSS: true });
            const skip = (el) => el.closest('.speaker-notes, .sr-only, .slide-footer, .slide-number');
            const outside = [...slide.querySelectorAll('*')].filter((el) => !skip(el) && !el.closest('svg *') && visible(el)).filter((el) => {
                const box = el.getBoundingClientRect();
                return box.width && box.height && (box.left < bounds.left - 2 || box.top < bounds.top - 2 || box.right > bounds.right + 2 || box.bottom > bounds.bottom + 2);
            }).map((el) => el.tagName + '.' + el.getAttribute('class'));
            const bar = slide.querySelector('.step-bar')?.getBoundingClientRect();
            const download = document.querySelector('.deck-download')?.getBoundingClientRect();
            const hits = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
            const lines = [];
            const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                const parent = node.parentElement;
                if (!node.textContent.trim() || skip(parent) || !visible(parent)) continue;
                const range = document.createRange();
                range.selectNodeContents(node);
                for (const rect of range.getClientRects()) lines.push({ text: node.textContent.trim().slice(0, 30), rect, size: parseFloat(getComputedStyle(parent).fontSize), inBar: !!parent.closest('.step-bar') });
            }
            return {
                outside,
                underBar: lines.filter((line) => !line.inBar && hits(line.rect, bar)).map((line) => line.text),
                underDownload: lines.filter((line) => hits(line.rect, download)).map((line) => line.text),
                small: lines.filter((line) => line.size < 19).map((line) => `${line.text} ${line.size}px`),
                targets: [...slide.querySelectorAll('.step-btn, .behavior, a.button')].map((el) => el.getBoundingClientRect()).map((box) => Math.min(box.width, box.height)),
            };
        });
        for (const [width, height] of [[1920, 1080], [1280, 720], [844, 390]]) {
            await p.setViewportSize({ width, height });
            for (let index = 0; index < count; index += 1) {
                await go(index);
                const item = scenes.find((s) => s.index === index);
                for (let k = 0; k < (item ? item.steps : 1); k += 1) {
                    if (item) await p.evaluate(({ name, k }) => window.entryHarnessFlow.setStep(name, k), { name: item.name, k });
                    const where = `${width}×${height} ${index + 1}쪽${item ? ` ${k + 1}단계` : ''}`;
                    const result = await layout();
                    assert.deepEqual(result.outside, [], `${where}: 슬라이드 밖으로 나감`);
                    assert.deepEqual(result.underBar, [], `${where}: 단계 버튼이 글자를 가림`);
                    if (width >= 1280) assert.deepEqual(result.underDownload, [], `${where}: PDF 버튼이 글자를 가림`);
                    if (width === 1920) assert.deepEqual(result.small, [], `${where}: 1080p에서 19px보다 작은 글자`);
                    if (width === 844) assert.ok(result.targets.every((size) => size >= 35.5), `${where}: 터치 대상이 작음 ${result.targets}`);
                }
            }
        }
        await p.setViewportSize({ width: 1920, height: 1080 });
        await still.evaluate((element) => element.remove());

        // ── 움직임 줄이기: 지연 없이 바로 최종 모습, 반복 애니메이션 없음 ──
        await p.emulateMedia({ reducedMotion: 'reduce' });
        await enterForward('request');
        await p.waitForTimeout(150);
        assert.equal(await p.evaluate(() => [...document.querySelectorAll('.slide.is-active .typed .ch')].every((ch) => getComputedStyle(ch).opacity === '1')), true, '움직임 줄이기: 타자 효과 없이 바로 표시');
        await p.locator('.slide.is-active [data-step-next]').click();
        await p.locator('.slide.is-active [data-step-next]').click();
        await p.waitForTimeout(150);
        assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.slide.is-active .real-req')).opacity), '1', '움직임 줄이기: 단계가 바로 바뀜');
        await enterForward('roles');
        await p.locator('.slide.is-active [data-step-next]').click();
        await p.waitForTimeout(150);
        assert.deepEqual(await p.evaluate(() => document.querySelector('.slide.is-active').getAnimations({ subtree: true }).filter((a) => a.playState === 'running').map((a) => a.effect.target.className)), [], '움직임 줄이기: 반복 애니메이션 없음');
        await p.emulateMedia({ reducedMotion: 'no-preference' });

        // ── 인쇄(PDF): 모든 장면을 완성 단계로, 반복 호출해도 같고, 끝나면 원래 단계로 ──
        await p.evaluate(() => { window.entryHarnessFlow.setStep('request', 1); window.entryHarnessFlow.setStep('overview', 3); });
        const before = (await state()).steps;
        await p.evaluate(() => window.ppt205Deck.preparePrint());
        const once = await state();
        await p.evaluate(() => window.ppt205Deck.preparePrint());
        assert.deepEqual(await state(), once, '인쇄 준비 반복 안정성');
        for (const item of scenes) assert.equal(once.steps[item.name], item.steps - 1, `${item.name}: 인쇄는 완성 단계`);
        assert.equal(await p.evaluate(() => [...document.querySelectorAll('.step-bar, .cover-help')].every((el) => getComputedStyle(el).display === 'none')), true, '인쇄에 단계 버튼·조작 안내 없음');
        assert.equal(await p.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.target?.closest?.('.slide')).length), 0, '인쇄 중 애니메이션 없음');
        assert.equal(await p.evaluate(() => ['.real-req', '.pipe-loop', '.tally', '.node.result .good', '.log-list li:last-child'].every((s) => getComputedStyle(document.querySelector(s)).opacity === '1')), true, '인쇄 장면에 완성 내용');
        await p.evaluate(() => dispatchEvent(new Event('afterprint')));
        assert.deepEqual((await state()).steps, before, '인쇄 뒤 원래 단계로 복귀');
        assert.equal((await state()).printing, false);

        // ── 글꼴: 화면 글자가 모두 포함된 자체 글꼴로 표시 ──
        const text = await p.evaluate(() => document.querySelector('.deck-stage').textContent + document.querySelector('.deck-controls').textContent);
        const missing = [...new Set([...text].filter((ch) => ch.trim() && !glyphs.has(ch)))];
        assert.deepEqual(missing, [], '글꼴에 없는 글자 (python source/subset-fonts.py 다시 실행)');
        assert.equal(await p.evaluate(() => [...document.fonts].filter((face) => face.family.replace(/"/g, '') === 'EHF Sans' && face.status === 'loaded').length), 3, 'EHF Sans 세 굵기 로드');

        const timers = await p.evaluate(() => window.__deckTimers);
        assert.deepEqual(timers, { timeout: 0, interval: 0, raf: 0 }, '자료 스크립트에 타이머·rAF 없음(자동 진행 없음)');
        assert.deepEqual(errors, [], '브라우저 오류');
    } finally {
        await p.close();
    }
    console.log(`${deck.slug}: 범위·순서·66/66 출처, 노트, 자동 전환 없음, 숨은 장 정지, 다시 재생, 단계↔슬라이드 분리, 되돌아오기, 3개 화면 크기 배치·글자 크기·터치, 움직임 줄이기, 인쇄 상태, 글꼴 검사 통과`);
}
