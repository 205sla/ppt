#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const myEntryRoot = process.env.MYENTRY_ROOT || 'C:/Users/young/prg/ENTRY/apps/MYentry-game';
const fixture = path.resolve(here, '../../downloads/ease-lab_007.ent');
const outputDir = path.resolve(here, '../../assets/blocks');

const { bootEditor, loadFixture } = await import(
    url.pathToFileURL(path.join(myEntryRoot, 'tools/lib/editor-harness.mjs'))
);

const targets = [
    { objectId: 'controller', threadIndex: 0, file: '01-controller.png' },
    { objectId: 'linear_ball', threadIndex: 1, file: '02-linear.png' },
    { objectId: 'ease_in_ball', threadIndex: 1, file: '03-ease-in.png' },
    { objectId: 'ease_out_ball', threadIndex: 1, file: '04-ease-out.png' },
    { objectId: 'ease_inout_ball', threadIndex: 1, file: '05-ease-in-out.png' },
];

fs.mkdirSync(outputDir, { recursive: true });

const { browser, page, pageErrors } = await bootEditor({ viewport: { width: 1600, height: 1000 } });

try {
    await loadFixture(page, fixture);
    const images = await page.evaluate(async (requests) => {
        const result = [];
        for (const request of requests) {
            Entry.container.selectObject(request.objectId);
            await new Promise((resolve) => setTimeout(resolve, 350));
            const object = Entry.container.getAllObjects().find((item) => item.id === request.objectId);
            if (!object) throw new Error(`오브젝트를 찾을 수 없음: ${request.objectId}`);
            const thread = object.script.getThreads()[request.threadIndex];
            if (!thread) throw new Error(`스크립트를 찾을 수 없음: ${request.objectId}[${request.threadIndex}]`);
            const topBlock = thread.getBlocks()[0];
            const view = topBlock?.getView?.() || topBlock?.view;
            if (!view || typeof view.getDataUrl !== 'function') {
                throw new Error(`블록 이미지 API를 찾을 수 없음: ${request.objectId}`);
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
            result.push({ ...request, dataUrl, blockTypes: thread.getBlocks().map((block) => block.type) });
        }
        return result;
    }, targets);

    for (const image of images) {
        const match = /^data:image\/png(?:;[^,]*)?;base64,(.+)$/s.exec(image.dataUrl);
        if (!match) {
            throw new Error(`${image.file}: PNG 데이터 URL 형식이 아닙니다. (${typeof image.dataUrl}: ${JSON.stringify(image.dataUrl).slice(0, 500)})`);
        }
        const destination = path.join(outputDir, image.file);
        fs.writeFileSync(destination, Buffer.from(match[1], 'base64'));
        console.log(`${image.file}  ${image.blockTypes.join(' → ')}`);
    }

    if (pageErrors.length) {
        throw new Error(`페이지 오류 ${pageErrors.length}개: ${pageErrors.join(' | ')}`);
    }
} finally {
    await browser.close();
}

console.log(`블록 이미지 ${targets.length}개 저장 완료: ${outputDir}`);
