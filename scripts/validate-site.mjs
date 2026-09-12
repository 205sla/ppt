#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const ignored = new Set(['.git', 'node_modules', 'test-results']);
const failures = [];
let checkedLinks = 0;

function walk(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        if (ignored.has(entry.name)) return [];
        const absolute = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(absolute) : [absolute];
    });
}

function checkReference(file, rawReference) {
    if (!rawReference || /^(?:https?:|mailto:|data:|javascript:|#)/i.test(rawReference)) return;
    const clean = decodeURIComponent(rawReference.split(/[?#]/)[0]);
    if (!clean) return;
    const target = clean.startsWith('/')
        ? path.resolve(root, `.${clean}`)
        : path.resolve(path.dirname(file), clean);
    const resolved = fs.existsSync(target) && fs.statSync(target).isDirectory() ? path.join(target, 'index.html') : target;
    checkedLinks += 1;
    if (!resolved.startsWith(root) || !fs.existsSync(resolved)) {
        failures.push(`${path.relative(root, file)} → ${rawReference}`);
    }
}

const files = walk(root);
for (const file of files.filter((candidate) => candidate.endsWith('.html'))) {
    const content = fs.readFileSync(file, 'utf8');
    for (const match of content.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) checkReference(file, match[1]);
    for (const match of content.matchAll(/<img\b[^>]*>/gi)) {
        if (!/\balt=["'][^"']*["']/i.test(match[0])) failures.push(`${path.relative(root, file)} → alt 없는 이미지`);
    }
    if (file.endsWith(`${path.sep}Ease${path.sep}index.html`)) {
        const slideCount = (content.match(/<section class="slide/g) || []).length;
        const noteCount = (content.match(/class="speaker-notes"/g) || []).length;
        if (slideCount !== 21) failures.push(`Ease/index.html → 슬라이드 수 ${slideCount}, 예상 21`);
        if (noteCount !== slideCount) failures.push(`Ease/index.html → 발표자 노트 ${noteCount}/${slideCount}`);
    }
}

for (const file of files.filter((candidate) => candidate.endsWith('.css'))) {
    const content = fs.readFileSync(file, 'utf8');
    for (const match of content.matchAll(/url\(["']?([^"')]+)["']?\)/gi)) checkReference(file, match[1]);
}

if (failures.length) {
    console.error(`검증 실패 ${failures.length}개`);
    failures.forEach((failure) => console.error(` - ${failure}`));
    process.exit(1);
}

console.log(`정적 사이트 검증 통과: 파일 ${files.length}개, 내부 참조 ${checkedLinks}개, Ease 슬라이드 21장`);
