#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const myEntryRoot = process.env.MYENTRY_ROOT || 'C:/Users/young/prg/ENTRY/apps/MYentry-game';
const downloadDir = path.resolve(here, '../../downloads');
const outputDir = path.resolve(here, '../../assets/blocks');

const { bootEditor, loadFixture } = await import(
    url.pathToFileURL(path.join(myEntryRoot, 'tools/lib/editor-harness.mjs'))
);

const targets = [
    { fixture: 'ease-step1_001.ent', objectId: 'ball', threadIndex: 0, file: '01-step1.png' },
    { fixture: 'ease-step2_001.ent', objectId: 'ball', threadIndex: 0, file: '02-step2.png' },
    { fixture: 'ease-linear_001.ent', objectId: 'ball', threadIndex: 0, file: '03-linear-main.png' },
    { fixture: 'ease-in_001.ent', objectId: 'ball', threadIndex: 0, file: '05-ease-in.png' },
    { fixture: 'ease-out_001.ent', objectId: 'ball', threadIndex: 0, file: '06-ease-out.png' },
    { fixture: 'ease-in-out_001.ent', objectId: 'ball', threadIndex: 0, file: '07-ease-in-out.png' },
    { fixture: 'ease-linear_001.ent', functionId: 'move', threadIndex: 0, file: '04-move-function.png' },
];

fs.mkdirSync(outputDir, { recursive: true });

const { browser, page, pageErrors } = await bootEditor({ viewport: { width: 1700, height: 1050 } });

try {
    for (const target of targets) {
        await loadFixture(page, path.join(downloadDir, target.fixture));
        const image = await page.evaluate(async (request) => {
            let thread;
            if (request.functionId) {
                const func = Entry.variableContainer.getFunction(request.functionId);
                if (!func) throw new Error(`함수를 찾을 수 없음: ${request.functionId}`);
                Entry.Func.edit(func);
                await new Promise((resolve) => setTimeout(resolve, 800));
                thread = func.content.getThreads()[request.threadIndex];
            } else {
                Entry.container.selectObject(request.objectId);
                await new Promise((resolve) => setTimeout(resolve, 450));
                const object = Entry.container.getAllObjects().find((item) => item.id === request.objectId);
                if (!object) throw new Error(`오브젝트를 찾을 수 없음: ${request.objectId}`);
                thread = object.script.getThreads()[request.threadIndex];
            }

            if (!thread) throw new Error(`스크립트를 찾을 수 없음: ${request.file}`);
            const topBlock = thread.getBlocks()[0];
            const view = topBlock?.getView?.() || topBlock?.view;
            if (!view || typeof view.getDataUrl !== 'function') {
                throw new Error(`블록 이미지 API를 찾을 수 없음: ${request.file}`);
            }

            const svgImage = await view.getDataUrl();
            const svgDocument = new DOMParser().parseFromString(svgImage.data, 'image/svg+xml');
            for (const imageElement of svgDocument.querySelectorAll('image')) {
                const href = imageElement.getAttribute('href')
                    || imageElement.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
                if (!href || href.startsWith('data:')) continue;
                const response = await fetch(href);
                if (!response.ok) throw new Error(`블록 아이콘을 불러오지 못함: ${href}`);
                const blob = await response.blob();
                const inlineUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                imageElement.setAttribute('href', inlineUrl);
                imageElement.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
            }

            const inlinedSvg = new XMLSerializer().serializeToString(svgDocument);
            const svgBlob = new Blob([inlinedSvg], { type: 'image/svg+xml;charset=utf-8' });
            const svgUrl = URL.createObjectURL(svgBlob);
            const bitmap = new Image();
            await new Promise((resolve, reject) => {
                bitmap.onload = resolve;
                bitmap.onerror = reject;
                bitmap.src = svgUrl;
            });
            const scale = 2;
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(svgImage.width * scale);
            canvas.height = Math.ceil(svgImage.height * scale);
            const context = canvas.getContext('2d');
            context.scale(scale, scale);
            context.drawImage(bitmap, 0, 0, svgImage.width, svgImage.height);
            const dataUrl = canvas.toDataURL('image/png');
            URL.revokeObjectURL(svgUrl);
            return {
                dataUrl,
                blockTypes: thread.getBlocks().map((block) => block.type),
            };
        }, target);

        const match = /^data:image\/png(?:;[^,]*)?;base64,(.+)$/s.exec(image.dataUrl);
        if (!match) throw new Error(`${target.file}: PNG 데이터 URL 형식이 아닙니다.`);
        fs.writeFileSync(path.join(outputDir, target.file), Buffer.from(match[1], 'base64'));
        console.log(`${target.file}  ${image.blockTypes.join(' -> ')}`);
    }

    if (pageErrors.length) {
        throw new Error(`페이지 오류 ${pageErrors.length}개: ${pageErrors.join(' | ')}`);
    }
} finally {
    await browser.close();
}

console.log(`블록 이미지 ${targets.length}개 저장 완료: ${outputDir}`);
