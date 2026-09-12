import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PDFDocument } from 'pdf-lib';
import { ROOT, readProject, selectDecks, walk } from './project.mjs';

export async function validateSite({ root = ROOT, slug, requirePdfs = false, forPublication = false, checkSyntax = true } = {}) {
    const project = readProject(root);
    const decks = selectDecks(project, slug);
    const failures = [];
    let links = 0;
    const countByDeck = {};
    const allowedFolders = new Set(['shared', ...selectDecks(project).map((deck) => deck.slug), ...decks.map((deck) => deck.slug)]);
    const files = [...['index.html', '404.html'].map((name) => path.join(root, name)).filter(fs.existsSync), ...walk(path.join(root, 'shared')), ...decks.flatMap((deck) => walk(path.join(root, deck.slug)))];
    function checkReference(file, raw) {
        if (!raw || /^(?:https?:|mailto:|tel:|data:|blob:|javascript:|#)/i.test(raw)) return;
        const reference = decodeURIComponent(raw.split(/[?#]/)[0]);
        if (!reference) return;
        if (!requirePdfs && /\.pdf$/i.test(reference)) return;
        let target = reference.startsWith('/') ? path.resolve(root, `.${reference}`) : path.resolve(path.dirname(file), reference);
        if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
        const relative = path.relative(root, target);
        const parts = relative.split(path.sep);
        links += 1;
        if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(target)) failures.push(`${path.relative(root, file)} → 링크 없음: ${raw}`);
        else if (file !== path.join(root, 'index.html') && ((parts.length > 1 && !allowedFolders.has(parts[0])) || parts.some((part) => part === 'source' || part === 'node_modules' || part.startsWith('.')))) {
            failures.push(`${path.relative(root, file)} → 배포에서 제외되는 파일 링크: ${raw}`);
        }
    }
    for (const deck of decks) {
        const index = path.join(root, deck.slug, 'index.html');
        if (!fs.existsSync(index)) { failures.push(`${deck.slug}/index.html 없음`); continue; }
        const html = fs.readFileSync(index, 'utf8');
        const slides = [...html.matchAll(/<section\b[^>]*\bclass=["'][^"']*\bslide\b[^"']*["'][^>]*>/gi)].length;
        countByDeck[deck.slug] = slides;
        if (!slides || !/\bdata-deck(?:\s|=|>)/.test(html)) failures.push(`${deck.slug}: [data-deck]와 .slide가 필요합니다.`);
        if (!html.includes('../shared/deck.js') || !html.includes('../shared/deck.css')) failures.push(`${deck.slug}: 공통 deck.js와 deck.css를 연결하세요.`);
        if ((forPublication || (deck.status || 'published') === 'published') && /data-template-placeholder|\{\{[A-Z_]+\}\}/.test(html)) failures.push(`${deck.slug}: 템플릿의 임시 내용을 채우고 data-template-placeholder 표시를 제거하세요.`);
        if (requirePdfs) {
            const pdfPath = path.join(root, deck.slug, 'downloads', `${deck.slug}.pdf`);
            try {
                const pdf = await PDFDocument.load(fs.readFileSync(pdfPath));
                if (pdf.getPageCount() !== slides) failures.push(`${deck.slug}: PDF ${pdf.getPageCount()}쪽 / 슬라이드 ${slides}장 불일치`);
            } catch { failures.push(`${deck.slug}: PDF가 없거나 올바르지 않습니다. npm run pdf -- ${deck.slug}`); }
        }
    }
    for (const file of files) {
        if (file.endsWith('.html')) {
            const html = fs.readFileSync(file, 'utf8');
            for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) checkReference(file, match[1]);
            for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
                if (!/\balt=["'][^"']*["']/i.test(match[0])) failures.push(`${path.relative(root, file)}: 이미지 alt 없음`);
            }
        } else if (file.endsWith('.css')) {
            for (const match of fs.readFileSync(file, 'utf8').matchAll(/url\(["']?([^"')]+)["']?\)/gi)) checkReference(file, match[1]);
        }
    }
    if (checkSyntax) {
        for (const file of [...files, ...walk(path.join(root, 'scripts'))].filter((file) => /\.m?js$/.test(file))) {
            const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
            if (result.status !== 0) failures.push(`${path.relative(root, file)}: JavaScript 문법 오류\n${result.stderr || result.error}`);
        }
    }
    if (failures.length) throw new Error(`검증 실패 ${failures.length}개\n${failures.map((failure) => ` - ${failure}`).join('\n')}`);
    return { decks: decks.length, files: files.length, links, countByDeck };
}
