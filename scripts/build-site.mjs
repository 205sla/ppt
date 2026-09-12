#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '_site');
const decks = JSON.parse(fs.readFileSync(path.join(root, 'decks.json'), 'utf8'));
if (path.dirname(output) !== root || path.basename(output) !== '_site') throw new Error('배포 출력 경로 오류');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

const escape = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const staticList = decks.map((deck) => `
    <article class="material">
        <div class="material-meta"><span class="category">${escape(deck.category || '발표')}</span>${deck.date ? `<time datetime="${escape(deck.date)}">${escape(deck.date.replaceAll('-', '.'))}</time>` : ''}</div>
        <div class="material-copy"><h3><a href="${deck.slug}/">${escape(deck.title)}</a></h3><p>${escape(deck.description)}</p><span class="material-detail">${escape(deck.meta)}</span></div>
        <div class="material-actions"><a class="open-link" href="${deck.slug}/">웹으로 보기 <span aria-hidden="true">↗</span></a><a class="pdf-link" href="${deck.slug}/downloads/${deck.slug}.pdf" download>PDF 다운로드 <span aria-hidden="true">↓</span></a></div>
    </article>`).join('');

for (const item of ['index.html', '404.html', '.nojekyll', 'decks.json', 'shared', ...decks.map((deck) => deck.slug)]) {
    const source = path.join(root, item);
    if (!fs.existsSync(source)) continue;
    fs.cpSync(source, path.join(output, item), {
        recursive: true,
        filter: (candidate) => !['source', 'node_modules', '.git'].includes(path.basename(candidate)),
    });
}
for (const deck of decks) {
    const deckPath = path.join(output, deck.slug, 'index.html');
    const pdfLink = `<a class="deck-download" href="downloads/${deck.slug}.pdf" download>PDF 다운로드 <span aria-hidden="true">↓</span></a>`;
    let deckHtml = fs.readFileSync(deckPath, 'utf8');
    const existingLink = /<a\b[^>]*class="[^"]*\bdeck-download\b[^"]*"[^>]*>[\s\S]*?<\/a>/;
    deckHtml = existingLink.test(deckHtml)
        ? deckHtml.replace(existingLink, pdfLink)
        : deckHtml.replace(/<body\b[^>]*>/, (body) => `${body}\n    ${pdfLink}`);
    fs.writeFileSync(deckPath, deckHtml);
}
// JavaScript가 비활성화되거나 목록 로딩에 실패해도 모든 자료와 PDF 링크를 제공합니다.
const indexPath = path.join(output, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8')
    .replace(/(<div class="deck-list" data-deck-list>)[\s\S]*?(\s*<\/div>\s*<p class="empty-state")/, `$1${staticList}\n                $2`)
    .replace(/(data-deck-count>)[^<]*/, `$1${decks.length}`);
fs.writeFileSync(indexPath, html);
console.log(`배포 폴더 생성: _site (${decks.length}개 자료, PDF 포함)`);
