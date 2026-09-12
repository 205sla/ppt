#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { ROOT, readProject, selectDecks, cliSlug } from './lib/project.mjs';
import { startServer } from './lib/server.mjs';
import { validateSite } from './lib/validate.mjs';

export async function exportPdfs({ root = ROOT, slug } = {}) {
    const project = readProject(root);
    const decks = selectDecks(project, slug);
    await validateSite({ root, slug, checkSyntax: false });
    if (!decks.length) { console.log('PDF를 생성할 공개 자료가 없습니다.'); return []; }
    const server = await startServer(root);
    let browser;
    const results = [];
    try {
        browser = await chromium.launch();
        for (const deck of decks) {
            const page = await browser.newPage({ viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1 });
            const errors = [];
            page.on('pageerror', (error) => errors.push(error.message));
            page.on('response', (response) => { if (response.status() >= 400) errors.push(response.status() + ' ' + response.url()); });
            const response = await page.goto(server.url + '/' + deck.slug + '/?print=1', { waitUntil: 'networkidle' });
            if (!response.ok()) throw new Error(deck.slug + ': 슬라이드 페이지를 읽을 수 없습니다.');
            await page.waitForFunction(() => window.ppt205Deck?.isPrint && document.querySelectorAll('.print-page').length > 0);
            await page.evaluate(async () => {
                await document.fonts.ready;
                await Promise.all([...document.images].map((image) => image.decode()));
                window.ppt205Deck.preparePrint();
            });
            await page.emulateMedia({ media: 'print' });
            const result = await page.evaluate((siteUrl) => {
                const slides = [...document.querySelectorAll('[data-deck] .slide')];
                const issues = [];
                slides.forEach((slide, index) => {
                    const bounds = slide.getBoundingClientRect();
                    if (Math.abs(bounds.width - 1536) > 1 || Math.abs(bounds.height - 864) > 1) issues.push((index + 1) + '쪽: 슬라이드 크기 오류');
                    for (const element of slide.querySelectorAll('h1, h2, h3, p, img, svg, table, [data-pdf-check]')) {
                        if (!element.getClientRects().length) continue;
                        const box = element.getBoundingClientRect();
                        if (box.left < bounds.left - 2 || box.right > bounds.right + 2 || box.top < bounds.top - 2 || box.bottom > bounds.bottom + 2) {
                            issues.push((index + 1) + '쪽: ' + element.tagName + ' 영역 벗어남');
                        }
                    }
                });
                document.querySelectorAll('a[href]').forEach((link) => {
                    const target = new URL(link.href);
                    if (target.origin === location.origin) link.href = new URL(target.pathname.slice(1) + target.search + target.hash, siteUrl).href;
                });
                return { count: slides.length, issues };
            }, project.config.url);
            if (errors.length || result.issues.length) throw new Error(deck.slug + ': PDF 생성 전 검증 실패\n' + [...errors, ...result.issues].join('\n'));
            const output = path.join(root, deck.slug, 'downloads', deck.slug + '.pdf');
            fs.mkdirSync(path.dirname(output), { recursive: true });
            const bytes = await page.pdf({ printBackground: true, preferCSSPageSize: true, tagged: true, outline: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
            const pdf = await PDFDocument.load(bytes);
            if (pdf.getPageCount() !== result.count) throw new Error(deck.slug + ': PDF와 슬라이드 페이지 수가 다릅니다.');
            if (pdf.getPages().some((item) => Math.abs(item.getWidth() / item.getHeight() - 16 / 9) > 0.001)) throw new Error(deck.slug + ': PDF 페이지 비율 오류');
            fs.writeFileSync(output, bytes);
            console.log(deck.slug + ': PDF ' + result.count + '쪽 생성 (' + Math.round(bytes.length / 1024) + ' KB)');
            results.push({ slug: deck.slug, pages: result.count, output });
            await page.close();
        }
        return results;
    } finally {
        await browser?.close();
        await server.close();
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    try { await exportPdfs({ slug: cliSlug() }); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}
