#!/usr/bin/env node
// 모든 슬라이드와 장면 단계를 캡처해 눈으로 확인할 때 씁니다. 저장소 루트에서:
//   node EntryHarnessFlow/source/preview.mjs [너비] [높이]
// 결과: test-results/EntryHarnessFlow-steps/<너비>x<높이>/ (단계별 PNG와 한 장 모아 보기)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from '../../scripts/lib/server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [width = 1920, height = 1080] = process.argv.slice(2).map(Number);
const output = path.join(root, 'test-results', 'EntryHarnessFlow-steps', `${width}x${height}`);
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

const server = await startServer(root);
const browser = await chromium.launch();
try {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(server.url + '/EntryHarnessFlow/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.entryHarnessFlow);
    await page.evaluate(() => document.fonts.ready);
    // 전환이 끝난 모습을 찍도록 움직임 시간을 없앱니다.
    await page.addStyleTag({ content: '*, *::before, *::after { transition-duration: 0s !important; transition-delay: 0s !important; animation-duration: 0s !important; animation-delay: 0s !important; }' });
    const scenes = await page.evaluate(() => window.entryHarnessFlow.scenes());
    const count = await page.evaluate(() => window.ppt205Deck.slides.length);
    const shots = [];
    for (let index = 0; index < count; index += 1) {
        await page.evaluate((i) => window.ppt205Deck.go(i), index);
        const scene = scenes.find((item) => item.index === index);
        for (let step = 0; step < (scene ? scene.steps : 1); step += 1) {
            if (scene) await page.evaluate(({ name, step }) => window.entryHarnessFlow.setStep(name, step), { name: scene.name, step });
            await page.waitForTimeout(60);
            const file = `s${String(index + 1).padStart(2, '0')}-${step + 1}.png`;
            await page.locator('.deck-stage').screenshot({ path: path.join(output, file) });
            shots.push([file, `${index + 1}${scene ? ` · ${step + 1}/${scene.steps} ${scene.labels[step]}` : ''}`]);
        }
    }
    const sheet = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
    await sheet.setContent('<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:10px;background:#dfe3e9;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;font:13px system-ui}img{display:block;width:100%}</style>'
        + shots.map(([file, label]) => `<figure style="margin:0"><img src="data:image/png;base64,${fs.readFileSync(path.join(output, file)).toString('base64')}"><figcaption>${label}</figcaption></figure>`).join(''));
    await sheet.screenshot({ path: path.join(output, 'contact.png'), fullPage: true });
    console.log(`${shots.length}장 캡처 → ${path.relative(root, output)}${errors.length ? '\n브라우저 오류:\n' + errors.join('\n') : ''}`);
} finally {
    await browser.close();
    await server.close();
}
