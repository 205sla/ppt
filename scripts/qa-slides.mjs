#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { ROOT, readProject, selectDecks, cliSlug } from './lib/project.mjs';
import { startServer } from './lib/server.mjs';

export async function qaSlides({ root = ROOT, slug, catalog = true } = {}) {
    const project = readProject(root);
    const decks = selectDecks(project, slug);
    const outputRoot = path.join(root, 'test-results');
    fs.mkdirSync(outputRoot, { recursive: true });
    const server = await startServer(root);
    let browser;
    const results = [];
    try {
        browser = await chromium.launch();
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
        if (catalog) {
            const published = selectDecks(project);
            await page.goto(server.url, { waitUntil: 'networkidle' });
            await page.locator('[data-deck-search]').waitFor({ state: 'visible' });
            if (await page.locator('.material').count() !== published.length) throw new Error('자료실 공개 목록 개수 오류');
            await page.screenshot({ path: path.join(outputRoot, 'home.png'), fullPage: true });
            await page.locator('[data-deck-search]').fill('__no_matching_deck_205__');
            if (!await page.locator('[data-empty-state]').isVisible()) throw new Error('자료 검색의 빈 결과 안내 오류');
            await page.locator('[data-deck-search]').fill('');
            if (published.length) {
                await page.locator('[data-deck-search]').fill(published[0].title);
                if (!await page.locator('.material h3 a').first().isVisible()) throw new Error('자료 제목 검색 오류');
                const pending = page.waitForEvent('download');
                await page.locator('.pdf-link').first().click();
                if (await (await pending).failure()) throw new Error('자료실 PDF 다운로드 실패');
                await page.locator('[data-deck-search]').fill('');
            }
            await page.locator('[data-deck-search]').blur();
            for (const width of [390, 320]) {
                await page.setViewportSize({ width, height: 844 });
                if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('자료실 모바일 가로 넘침: ' + width);
                if (width === 390) await page.screenshot({ path: path.join(outputRoot, 'home-mobile.png'), fullPage: true });
            }
        }

        await page.setViewportSize({ width: 1920, height: 1080 });
        for (const deck of decks) {
            const output = path.join(outputRoot, deck.slug);
            fs.mkdirSync(output, { recursive: true });
            await page.goto(server.url + '/' + deck.slug + '/', { waitUntil: 'networkidle' });
            await page.waitForFunction(() => window.ppt205Deck?.slides?.length > 0);
            await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((image) => image.decode())); });
            const count = await page.evaluate(() => window.ppt205Deck.slides.length);
            if (!await page.locator('.deck-download').isVisible()) throw new Error(deck.slug + ': PDF 다운로드 버튼 없음');
            const download = await page.request.get(server.url + '/' + deck.slug + '/downloads/' + deck.slug + '.pdf');
            if (!download.ok()) throw new Error(deck.slug + ': PDF 다운로드 실패');
            const pdf = await PDFDocument.load(await download.body());
            if (pdf.getPageCount() !== count) throw new Error(deck.slug + ': PDF 페이지 수 불일치');
            await page.addStyleTag({ content: '.slide { animation: none !important; }' });
            for (let index = 0; index < count; index += 1) {
                await page.evaluate((target) => window.ppt205Deck.go(target), index);
                const issues = await page.evaluate(() => {
                    const slide = document.querySelector('.slide.is-active');
                    const bounds = slide.getBoundingClientRect();
                    return [...slide.querySelectorAll('*')].flatMap((element) => {
                        const style = getComputedStyle(element);
                        const box = element.getBoundingClientRect();
                        if (element.closest('.speaker-notes, .sr-only') || !box.width || !box.height || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return [];
                        return box.left < bounds.left - 2 || box.top < bounds.top - 2 || box.right > bounds.right + 2 || box.bottom > bounds.bottom + 2
                            ? [element.tagName + '.' + (element.getAttribute('class') || '')] : [];
                    });
                });
                if (issues.length) throw new Error(deck.slug + ' ' + (index + 1) + '쪽 영역 벗어남: ' + [...new Set(issues)].join(', '));
                await page.locator('.deck-stage').screenshot({ path: path.join(output, 'slide-' + String(index + 1).padStart(2, '0') + '.png') });
            }
            await page.evaluate(() => window.ppt205Deck.go(0));
            if (count > 1) {
                await page.keyboard.press('ArrowRight');
                if (await page.evaluate(() => window.ppt205Deck.current) !== 1) throw new Error(deck.slug + ': 다음 슬라이드 키보드 이동 실패');
                await page.keyboard.press('ArrowLeft');
            }
            await page.keyboard.press('KeyN');
            if (!await page.locator('body').evaluate((body) => body.classList.contains('show-notes'))) throw new Error(deck.slug + ': 발표자 노트 실패');
            await page.keyboard.press('KeyN');
            const customQa = path.join(root, deck.slug, 'source', 'qa.mjs');
            if (fs.existsSync(customQa)) await (await import(pathToFileURL(customQa).href)).default({ page, baseUrl: server.url, deck });
            await page.evaluate(() => window.ppt205Deck.preparePrint());
            if (await page.locator('.print-page').count() !== count) throw new Error(deck.slug + ': 인쇄 페이지 수 오류');
            await page.evaluate(() => dispatchEvent(new Event('afterprint')));
            if (await page.locator('.slide.is-active').count() !== 1) throw new Error(deck.slug + ': 인쇄 후 복귀 실패');

            const contact = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
            const html = '<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:12px;background:#dfe3e9;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0}img{display:block;width:100%}figcaption{padding:5px;font:14px system-ui}</style>'
                + Array.from({ length: count }, (_, index) => '<figure><img src="data:image/png;base64,' + fs.readFileSync(path.join(output, 'slide-' + String(index + 1).padStart(2, '0') + '.png')).toString('base64') + '"><figcaption>' + (index + 1) + '</figcaption></figure>').join('');
            await contact.setContent(html);
            await contact.screenshot({ path: path.join(output, 'contact-sheet.png'), fullPage: true });
            await contact.close();
            results.push({ slug: deck.slug, slides: count });
            console.log(deck.slug + ': ' + count + '장, 레이아웃·키보드·노트·PDF·인쇄 복귀 검증 통과');
        }
        if (errors.length) throw new Error('브라우저 오류:\n' + errors.join('\n'));
        return results;
    } finally {
        await browser?.close();
        await server.close();
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    try { await qaSlides({ slug: cliSlug() }); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}
