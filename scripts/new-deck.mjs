#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, readProject, assertSlug, writeDecks, escapeHtml } from './lib/project.mjs';

export function createDeck({ root = ROOT, slug, title, category, theme, date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) }) {
    const project = readProject(root);
    assertSlug(slug);
    if (!title?.trim()) throw new Error('--title로 발표 제목을 지정하세요.');
    theme ||= project.config.defaultTheme;
    category ||= project.config.defaultCategory;
    if (!['light', 'dark'].includes(theme)) throw new Error('--theme은 light 또는 dark입니다.');
    const target = path.join(project.root, slug);
    if (project.decks.some((item) => item.slug.toLowerCase() === slug.toLowerCase()) || fs.readdirSync(root).some((name) => name.toLowerCase() === slug.toLowerCase())) {
        throw new Error(`${slug}: 같은 이름의 자료나 폴더가 있어 덮어쓰지 않습니다.`);
    }
    const template = path.join(root, 'templates', 'basic');
    const tokens = {
        TITLE: escapeHtml(title.trim()), SLUG: slug, CATEGORY: escapeHtml(category), DATE: escapeHtml(date),
        THEME_STYLESHEET: theme === 'light' ? '<link rel="stylesheet" href="../shared/themes/light.css">' : '',
    };
    // 템플릿을 모두 읽은 다음 폴더를 만들어 중간 실패로 빈 자료가 생기는 일을 줄입니다.
    const files = ['index.html', 'styles.css', 'deck.js'].map((name) => [name, fs.readFileSync(path.join(template, name), 'utf8').replace(/\{\{([A-Z_]+)\}\}/g, (_all, token) => tokens[token] ?? (() => { throw new Error('정의되지 않은 템플릿 값: ' + token); })())]);
    fs.mkdirSync(target);
    for (const [name, content] of files) fs.writeFileSync(path.join(target, name), content, { flag: 'wx' });
    for (const directory of ['assets', 'downloads', 'source']) {
        fs.mkdirSync(path.join(target, directory));
        fs.writeFileSync(path.join(target, directory, '.gitkeep'), '');
    }
    const deck = { slug, title: title.trim(), status: 'draft', category, date, description: '', meta: '' };
    writeDecks(project, [...project.decks, deck]);
    return deck;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    try {
        const [slug, ...args] = process.argv.slice(2);
        const options = { slug };
        for (let i = 0; i < args.length; i += 2) {
            const key = args[i].replace(/^--/, '');
            if (!['title', 'category', 'theme'].includes(key) || !args[i + 1]) throw new Error('사용법: npm run deck:new -- Folder --title "제목" [--category "과제"] [--theme light|dark]');
            options[key] = args[i + 1];
        }
        const deck = createDeck(options);
        console.log(`${deck.slug}/ 생성 및 초안 등록 완료\n로컬 주소: http://127.0.0.1:4173/${deck.slug}/\nPDF: npm run pdf -- ${deck.slug}\n내용 작성 후: npm run deck:publish -- ${deck.slug}`);
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}
