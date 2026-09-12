#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { spawn } from 'node:child_process';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outputDir = path.join(root, 'test-results', 'slides');
const myEntryRoot = process.env.MYENTRY_ROOT || 'C:/Users/young/prg/ENTRY/apps/MYentry-game';
const { chromium } = await import(url.pathToFileURL(path.join(myEntryRoot, 'node_modules/@playwright/test/index.mjs')));
const port = 4174;
const baseUrl = `http://127.0.0.1:${port}`;

fs.mkdirSync(outputDir, { recursive: true });
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
    cwd: root,
    env: { ...process.env, PPT_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
});

async function waitForServer() {
    for (let attempt = 0; attempt < 40; attempt += 1) {
        try {
            const response = await fetch(`${baseUrl}/Ease/`);
            if (response.ok) return;
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('검수용 로컬 서버가 시작되지 않았습니다.');
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const browserErrors = [];
page.on('pageerror', (error) => browserErrors.push(error.message));
page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
});

try {
    await waitForServer();
    await page.goto(`${baseUrl}/Ease/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.ppt205Deck?.slides?.length === 22);
    await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
    const slideCount = await page.evaluate(() => window.ppt205Deck.slides.length);

    const entryFiles = [
        'ease-step1_001.ent',
        'ease-step2_001.ent',
        'ease-linear_001.ent',
        'ease-in_001.ent',
        'ease-out_001.ent',
        'ease-in-out_001.ent',
    ];
    for (const file of entryFiles) {
        const downloadResponse = await page.request.get(`${baseUrl}/Ease/downloads/${file}`);
        if (!downloadResponse.ok() || (await downloadResponse.body()).length < 8_000) {
            throw new Error(`${file} 다운로드 응답이 올바르지 않습니다.`);
        }
    }

    const layoutProblems = [];
    for (let index = 0; index < slideCount; index += 1) {
        await page.evaluate((target) => window.ppt205Deck.go(target), index);
        await page.waitForTimeout(90);
        const problems = await page.evaluate(() => {
            const slide = document.querySelector('.slide.is-active');
            const slideRect = slide.getBoundingClientRect();
            const issues = [];
            const visible = [...slide.querySelectorAll('*')].filter((element) => {
                const style = getComputedStyle(element);
                return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0;
            });
            for (const element of visible) {
                const rect = element.getBoundingClientRect();
                if (!rect.width || !rect.height) continue;
                const outside = rect.left < slideRect.left - 2 || rect.top < slideRect.top - 2
                    || rect.right > slideRect.right + 2 || rect.bottom > slideRect.bottom + 2;
                if (outside) {
                    issues.push(`${element.tagName.toLowerCase()}.${element.className || '-'} outside `
                        + `[${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.right)},${Math.round(rect.bottom)}] `
                        + `slide=[${Math.round(slideRect.left)},${Math.round(slideRect.top)},${Math.round(slideRect.right)},${Math.round(slideRect.bottom)}]`);
                }
            }
            for (const image of slide.querySelectorAll('img')) {
                if (!image.complete || image.naturalWidth === 0) issues.push(`img ${image.getAttribute('src')} failed`);
            }
            return [...new Set(issues)].slice(0, 8);
        });
        if (problems.length) layoutProblems.push({ slide: index + 1, problems });
        await page.locator('.deck-stage').screenshot({ path: path.join(outputDir, `slide-${String(index + 1).padStart(2, '0')}.png`) });
    }

    await page.evaluate(() => window.ppt205Deck.go(1));
    await page.locator('[data-race-play-proxy]').click();
    await page.waitForTimeout(350);
    const raceMoved = await page.locator('[data-race][data-autoplay="true"] .runner').first().evaluate((element) => parseFloat(element.style.left) > 0);
    if (!raceMoved) throw new Error('공 경주 재생 버튼이 동작하지 않습니다.');

    await page.evaluate(() => {
        const index = window.ppt205Deck.slides.findIndex((slide) => slide.querySelector('[data-matching]'));
        window.ppt205Deck.go(index);
    });
    await page.locator('.match-row').first().locator('[data-match-choice="easeOut"]').click();
    if (!await page.locator('.match-row').first().locator('[data-match-choice="easeOut"]').evaluate((element) => element.classList.contains('is-correct'))) {
        throw new Error('적용 퀴즈 피드백이 동작하지 않습니다.');
    }

    await page.evaluate(() => window.ppt205Deck.go(0));
    await page.keyboard.press('ArrowRight');
    if (await page.evaluate(() => window.ppt205Deck.current) !== 1) throw new Error('키보드 다음 슬라이드 이동이 동작하지 않습니다.');
    await page.keyboard.press('KeyN');
    if (!await page.locator('body').evaluate((element) => element.classList.contains('show-notes'))) throw new Error('발표자 노트 단축키가 동작하지 않습니다.');

    const contactHtml = `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#10131b;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0;background:#000}img{display:block;width:100%;aspect-ratio:16/9;object-fit:contain}figcaption{padding:5px 8px;color:#fff;font:14px system-ui}</style>${Array.from({ length: slideCount }, (_, index) => `<figure><img src="slides/slide-${String(index + 1).padStart(2, '0')}.png"><figcaption>${String(index + 1).padStart(2, '0')}</figcaption></figure>`).join('')}`;
    fs.writeFileSync(path.join(root, 'test-results', 'contact.html'), contactHtml);
    const contact = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });
    await contact.goto(`${baseUrl}/test-results/contact.html`, { waitUntil: 'networkidle' });
    await contact.screenshot({ path: path.join(root, 'test-results', 'contact-sheet.png'), fullPage: true });
    await contact.close();

    if (browserErrors.length || layoutProblems.length) {
        if (browserErrors.length) console.error('브라우저 오류:', browserErrors);
        if (layoutProblems.length) console.error('레이아웃 문제:', JSON.stringify(layoutProblems, null, 2));
        process.exitCode = 1;
    } else {
        console.log(`슬라이드 QA 통과: ${slideCount}장, 이미지, 키보드, 노트, 경주, 퀴즈, 단계별 .ent 다운로드`);
        console.log(`콘택트 시트: ${path.join(root, 'test-results', 'contact-sheet.png')}`);
    }
} finally {
    await browser.close();
    server.kill();
}
