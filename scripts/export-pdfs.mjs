#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const decks = JSON.parse(fs.readFileSync(path.join(root, 'decks.json'), 'utf8'));
const port = Number(process.env.PDF_PORT || 4175);
const baseUrl = `http://127.0.0.1:${port}`;
const publicUrl = process.env.SITE_URL || 'https://ppt.205.kr/';
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
    cwd: root,
    env: { ...process.env, PPT_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
});
let serverError = '';
server.stderr.on('data', (data) => { serverError += data; });
let browser;

try {
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('PDF 서버 시작 시간 초과')), 15_000);
        server.once('error', (error) => { clearTimeout(timeout); reject(error); });
        server.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`PDF 서버 종료: ${code} ${serverError}`)); });
        server.stdout.once('data', () => { clearTimeout(timeout); resolve(); });
    });
    browser = await chromium.launch();
    for (const deck of decks) {
        if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(deck.slug)) throw new Error(`잘못된 폴더명: ${deck.slug}`);
        const page = await browser.newPage({ viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1 });
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
        const response = await page.goto(`${baseUrl}/${deck.slug}/?print=1`, { waitUntil: 'networkidle' });
        if (!response.ok()) throw new Error(`${deck.slug}: 슬라이드 페이지를 읽을 수 없습니다.`);
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
                if (Math.abs(bounds.width - 1536) > 1 || Math.abs(bounds.height - 864) > 1) issues.push(`${index + 1}쪽: 슬라이드 크기 오류`);
                for (const element of slide.querySelectorAll('h1, h2, h3, p, .block-image, .curve-svg, .race-board, .formula')) {
                    if (!element.getClientRects().length) continue;
                    const box = element.getBoundingClientRect();
                    if (box.left < bounds.left - 2 || box.right > bounds.right + 2 || box.top < bounds.top - 2 || box.bottom > bounds.bottom + 2) {
                        issues.push(`${index + 1}쪽: ${element.tagName}.${element.className} 영역 벗어남`);
                    }
                }
            });
            // PDF 안의 실습 파일 링크도 배포 주소로 연결합니다.
            document.querySelectorAll('a[href]').forEach((link) => {
                const target = new URL(link.href);
                if (target.origin === location.origin) link.href = new URL(target.pathname.slice(1) + target.search + target.hash, siteUrl).href;
            });
            return { count: slides.length, issues };
        }, publicUrl);
        if (errors.length || result.issues.length) throw new Error(`${deck.slug}: PDF 생성 전 검증 실패\n${[...errors, ...result.issues].join('\n')}`);

        const output = path.join(root, deck.slug, 'downloads', `${deck.slug}.pdf`);
        fs.mkdirSync(path.dirname(output), { recursive: true });
        const pdfBytes = await page.pdf({ printBackground: true, preferCSSPageSize: true, tagged: true, outline: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
        const pdf = await PDFDocument.load(pdfBytes);
        if (pdf.getPageCount() !== result.count) throw new Error(`${deck.slug}: PDF ${pdf.getPageCount()}쪽 / 슬라이드 ${result.count}장 불일치`);
        for (const pdfPage of pdf.getPages()) {
            const { width, height } = pdfPage.getSize();
            if (Math.abs(width / height - 16 / 9) > 0.001) throw new Error(`${deck.slug}: PDF 페이지 비율 오류`);
        }
        // Chromium 원본을 보존해 글자, 링크, 문서 구조를 유지합니다.
        fs.writeFileSync(output, pdfBytes);
        console.log(`${deck.slug}: PDF ${result.count}쪽 생성 (${Math.round(pdfBytes.length / 1024)} KB)`);
        await page.close();
    }
} finally {
    await browser?.close();
    server.kill();
}
