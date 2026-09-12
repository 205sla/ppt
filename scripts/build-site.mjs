#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, readProject, selectDecks, escapeHtml as escape } from './lib/project.mjs';
import { validateSite } from './lib/validate.mjs';

export async function buildSite({ root = ROOT } = {}) {
    const project = readProject(root);
    const decks = selectDecks(project);
    // 소스와 PDF가 모두 정상일 때만 배포 폴더를 갱신합니다.
    await validateSite({ root, requirePdfs: true });
    const output = path.join(project.root, '_site');
    if (path.dirname(output) !== project.root || path.basename(output) !== '_site') throw new Error('배포 출력 경로 오류');
    fs.rmSync(output, { recursive: true, force: true });
    fs.mkdirSync(output, { recursive: true });

    for (const item of ['index.html', '404.html', '.nojekyll', 'shared', ...decks.map((deck) => deck.slug)]) {
        const source = path.join(project.root, item);
        if (!fs.existsSync(source)) continue;
        fs.cpSync(source, path.join(output, item), {
            recursive: true,
            filter: (candidate) => !['source', 'node_modules', '.git'].includes(path.basename(candidate)),
        });
    }
    fs.writeFileSync(path.join(output, 'decks.json'), JSON.stringify(decks, null, 2) + '\n');
    for (const deck of decks) {
        const file = path.join(output, deck.slug, 'index.html');
        const pdfLink = '<a class="deck-download" href="downloads/' + deck.slug + '.pdf" download>PDF 다운로드 <span aria-hidden="true">↓</span></a>';
        let html = fs.readFileSync(file, 'utf8');
        const existing = /<a\b[^>]*class="[^"]*\bdeck-download\b[^"]*"[^>]*>[\s\S]*?<\/a>/;
        html = existing.test(html) ? html.replace(existing, () => pdfLink) : html.replace(/<body\b[^>]*>/, (body) => body + '\n    ' + pdfLink);
        fs.writeFileSync(file, html);
    }

    const rows = decks.map((deck) => '<article class="material">'
        + '<div class="material-meta"><span class="category">' + escape(deck.category || project.config.defaultCategory) + '</span>'
        + (deck.date ? '<time datetime="' + escape(deck.date) + '">' + escape(deck.date.replaceAll('-', '.')) + '</time>' : '') + '</div>'
        + '<div class="material-copy"><h3><a href="' + deck.slug + '/">' + escape(deck.title) + '</a></h3><p>' + escape(deck.description) + '</p><span class="material-detail">' + escape(deck.meta) + '</span></div>'
        + '<div class="material-actions"><a class="open-link" href="' + deck.slug + '/">웹으로 보기 <span aria-hidden="true">↗</span></a><a class="pdf-link" href="' + deck.slug + '/downloads/' + deck.slug + '.pdf" download>PDF 다운로드 <span aria-hidden="true">↓</span></a></div>'
        + '</article>').join('\n');
    const file = path.join(output, 'index.html');
    const html = fs.readFileSync(file, 'utf8')
        .replace(/(<div class="deck-list" data-deck-list>)[\s\S]*?(\s*<\/div>\s*<p class="empty-state")/, (_all, start, end) => start + '\n' + rows + '\n' + end)
        .replace(/(data-deck-count>)[^<]*/, (_all, prefix) => prefix + decks.length)
        .replace(/<title>[^<]*<\/title>/, () => '<title>' + escape(project.config.title) + '</title>')
        .replace(/(<meta name="description" content=")[^"]*/, (_all, prefix) => prefix + escape(project.config.description))
        .replace(/(data-site-name>)[^<]*/g, (_all, prefix) => prefix + escape(project.config.title))
        .replace(/(data-site-host>)[^<]*/g, (_all, prefix) => prefix + escape(new URL(project.config.url).host));
    fs.writeFileSync(file, html);
    console.log('배포 폴더 생성: _site (공개 자료 ' + decks.length + '개, 초안 ' + (project.decks.length - decks.length) + '개 제외)');
    return { output, decks };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    await buildSite();
}
