#!/usr/bin/env node

import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const myEntryRoot = process.env.MYENTRY_ROOT || 'C:/Users/young/prg/ENTRY/apps/MYentry-game';
const fixture = path.resolve(here, '../../downloads/ease-lab_007.ent');
const screenshot = path.resolve(here, '../../assets/ease-lab-stage.png');

const editorHarness = await import(url.pathToFileURL(path.join(myEntryRoot, 'tools/lib/editor-harness.mjs')));
const verifyHarness = await import(url.pathToFileURL(path.join(myEntryRoot, 'tools/lib/verify-harness.mjs')));
const { bootEditor, loadFixture } = editorHarness;
const { runFresh, waitFor, waitForVar, createReporter } = verifyHarness;

const report = createReporter();
const { browser, page, pageErrors } = await bootEditor({ viewport: { width: 1440, height: 940 } });

try {
    await loadFixture(page, fixture);
    await runFresh(page);

    const readMiddle = (currentPage) => currentPage.evaluate(() => {
        const variables = Entry.variableContainer.variables_;
        const value = (name) => Number(variables.find((item) => item.name_ === name)?.getValue());
        const objects = Entry.container.getAllObjects();
        const x = (name) => Number(objects.find((item) => item.name === name)?.entity.x);
        return {
            t: value('시간 비율 t'),
            linear: value('일정하게 p'),
            easeIn: value('천천히 출발 p'),
            easeOut: value('천천히 도착 p'),
            easeInOut: value('양쪽 천천히 p'),
            positions: {
                linear: x('일정하게 공'),
                easeIn: x('천천히 출발 공'),
                easeOut: x('천천히 도착 공'),
                easeInOut: x('양쪽 천천히 공'),
            },
        };
    });

    const expectedAt = (kind, t) => {
        if (kind === 'linear') return t;
        if (kind === 'easeIn') return t * t;
        if (kind === 'easeOut') return 1 - (1 - t) * (1 - t);
        return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
    };
    const close = (actual, expected, tolerance = 0.025) => Math.abs(actual - expected) <= tolerance;

    const middle = await waitFor(page, readMiddle, (state) => {
        if (state.t < 0.48 || state.t > 0.56) return false;
        return close(state.linear, expectedAt('linear', state.t))
            && close(state.easeIn, expectedAt('easeIn', state.t))
            && close(state.easeOut, expectedAt('easeOut', state.t))
            && close(state.easeInOut, expectedAt('easeInOut', state.t));
    }, { timeoutMs: 5000, intervalMs: 10, label: 'synchronized midpoint' });

    report.ok(close(middle.linear, expectedAt('linear', middle.t)), '일정한 움직임 p=t');
    report.ok(close(middle.easeIn, expectedAt('easeIn', middle.t)), '천천히 출발 p=t×t');
    report.ok(close(middle.easeOut, expectedAt('easeOut', middle.t)), '천천히 도착 p=1-(1-t)×(1-t)');
    report.ok(close(middle.easeInOut, expectedAt('easeInOut', middle.t)), '양쪽 천천히 구간식');
    report.ok(middle.positions.easeIn < middle.positions.linear, '중간 시점에 천천히 출발 공이 뒤에 있음');
    report.ok(middle.positions.easeOut > middle.positions.linear, '중간 시점에 천천히 도착 공이 앞에 있음');

    const box = await page.evaluate(() => {
        const element = document.querySelector('#entryCanvas');
        const rect = element.getBoundingClientRect();
        return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    });
    await page.screenshot({ path: screenshot, clip: box });

    await waitForVar(page, '완료', (value) => Number(value) === 1, { timeoutMs: 7000 });
    const final = await page.evaluate(() => {
        const variables = Entry.variableContainer.variables_;
        const objects = Entry.container.getAllObjects();
        const t = Number(variables.find((item) => item.name_ === '시간 비율 t')?.getValue());
        const xs = ['일정하게 공', '천천히 출발 공', '천천히 도착 공', '양쪽 천천히 공']
            .map((name) => Number(objects.find((item) => item.name === name)?.entity.x));
        return { t, xs };
    });

    report.ok(close(final.t, 1, 0.001), '마지막 시간 비율은 1');
    report.ok(final.xs.every((value) => Math.abs(value - 230) < 0.1), '네 공이 같은 도착점에 도착');
    report.eq(pageErrors, [], '실행 중 페이지 오류 없음');
} finally {
    await browser.close();
}

process.exit(report.summary());
