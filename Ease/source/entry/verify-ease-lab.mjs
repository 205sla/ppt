#!/usr/bin/env node

import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const myEntryRoot = process.env.MYENTRY_ROOT || 'C:/Users/young/prg/ENTRY/apps/MYentry-game';
const downloadDir = path.resolve(here, '../../downloads');
const screenshot = path.resolve(here, '../../assets/ease-lab-stage.png');

const editorHarness = await import(url.pathToFileURL(path.join(myEntryRoot, 'tools/lib/editor-harness.mjs')));
const verifyHarness = await import(url.pathToFileURL(path.join(myEntryRoot, 'tools/lib/verify-harness.mjs')));
const { bootEditor, loadFixture } = editorHarness;
const { stopEngine, runFresh, waitFor, waitForVar, createReporter } = verifyHarness;

const cases = [
    { file: 'ease-step1_001.ent', kind: 'step1' },
    { file: 'ease-step2_001.ent', kind: 'step2' },
    { file: 'ease-linear_001.ent', kind: 'linear' },
    { file: 'ease-in_001.ent', kind: 'easeIn' },
    { file: 'ease-out_001.ent', kind: 'easeOut' },
    { file: 'ease-in-out_001.ent', kind: 'easeInOut' },
];

const expectedProgress = (kind, t) => {
    if (kind === 'easeIn') return t * t;
    if (kind === 'easeOut') return 1 - (1 - t) * (1 - t);
    if (kind === 'easeInOut') return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
    return t;
};

const expectedX = (kind, t) => {
    if (kind === 'step1') return t * 100;
    if (kind === 'step2') return t * 200 - 100;
    return expectedProgress(kind, t) * 200 - 100;
};

const close = (actual, expected, tolerance = 0.04) => Math.abs(actual - expected) <= tolerance;
const report = createReporter();
const { browser, page, pageErrors } = await bootEditor({ viewport: { width: 1440, height: 940 } });

try {
    for (const testCase of cases) {
        await stopEngine(page);
        await loadFixture(page, path.join(downloadDir, testCase.file));
        await runFresh(page);

        const readState = (currentPage) => currentPage.evaluate(() => {
            const variables = Entry.variableContainer.variables_;
            const value = (name) => {
                const variable = variables.find((item) => item.name_ === name);
                return variable ? Number(variable.getValue()) : undefined;
            };
            const ball = Entry.container.getAllObjects().find((item) => item.name === '공');
            return { t: value('t'), p: value('p'), x: Number(ball?.entity.x) };
        });

        const middle = await waitFor(page, readState, (state) => state.t >= 0.48 && state.t <= 0.56, {
            timeoutMs: 5000,
            intervalMs: 10,
            label: `${testCase.kind} midpoint`,
        });

        report.ok(close(middle.x, expectedX(testCase.kind, middle.t), 1.2), `${testCase.kind}: 중간 위치 공식`);
        if (!['step1', 'step2'].includes(testCase.kind)) {
            report.ok(
                close(middle.p, expectedProgress(testCase.kind, middle.t)),
                `${testCase.kind}: p 계산`,
            );
        }

        if (testCase.kind === 'easeIn') {
            const box = await page.evaluate(() => {
                const element = document.querySelector('#entryCanvas');
                const rect = element.getBoundingClientRect();
                return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
            });
            await page.screenshot({ path: screenshot, clip: box });
        }

        await waitForVar(page, 't', (value) => Number(value) >= 0.999, { timeoutMs: 5000 });
        const final = await readState(page);
        report.ok(close(final.t, 1, 0.002), `${testCase.kind}: 마지막 t는 1`);
        report.ok(close(final.x, 100, 0.2), `${testCase.kind}: x=100에 도착`);
    }

    report.eq(pageErrors, [], '실행 중 페이지 오류 없음');
} finally {
    await browser.close();
}

process.exit(report.summary());
