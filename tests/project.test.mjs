import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, assertSlug, readProject, selectDecks, writeDecks } from '../scripts/lib/project.mjs';
import { createDeck } from '../scripts/new-deck.mjs';
import { validateSite } from '../scripts/lib/validate.mjs';
import { exportPdfs } from '../scripts/export-pdfs.mjs';
import { buildSite } from '../scripts/build-site.mjs';
import { qaSlides } from '../scripts/qa-slides.mjs';

function copyTree(source, target) {
    if (!fs.statSync(source).isDirectory()) { fs.copyFileSync(source, target); return; }
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source)) copyTree(path.join(source, entry), path.join(target, entry));
}

function fixture(t) {
    const parent = path.join(ROOT, 'test-results', 'fixtures');
    fs.mkdirSync(parent, { recursive: true });
    const root = fs.mkdtempSync(path.join(parent, 'deck-'));
    for (const item of ['site.config.json', 'shared', 'templates']) copyTree(path.join(ROOT, item), path.join(root, item));
    fs.writeFileSync(path.join(root, 'decks.json'), '[]\n');
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><html><head><title>검증 자료실</title></head><body><span data-deck-count>0</span><div class="deck-list" data-deck-list></div><p class="empty-state"></p></body></html>');
    t.after(() => {
        if (path.dirname(root) !== parent || !path.basename(root).startsWith('deck-')) throw new Error('테스트 임시 폴더 경로 오류');
        fs.rmSync(root, { recursive: true, force: true });
    });
    return root;
}

test('폴더 경로 탈출, 예약 이름, 대소문자 중복을 거부한다', (t) => {
    for (const name of ['../Escape', 'shared', 'CON', 'COM1', '_site', 'a/b', '자료']) assert.throws(() => assertSlug(name));
    const root = fixture(t);
    createDeck({ root, slug: 'Report', title: '보고서' });
    assert.throws(() => createDeck({ root, slug: 'report', title: '덮어쓰기' }), /덮어쓰지/);
    assert.equal(readProject(root).decks.length, 1);
});

test('새 자료는 초안이며 제목과 속성을 HTML에 안전하게 넣는다', (t) => {
    const root = fixture(t);
    createDeck({ root, slug: 'Essay', title: 'A "비교" <B>', category: '과제' });
    const project = readProject(root);
    assert.equal(selectDecks(project).length, 0);
    assert.equal(selectDecks(project, 'Essay')[0].status, 'draft');
    const html = fs.readFileSync(path.join(root, 'Essay/index.html'), 'utf8');
    assert.match(html, /A &quot;비교&quot; &lt;B&gt;/);
    assert.match(html, /downloads\/Essay.pdf/);
    assert.match(html, /shared\/themes\/light.css/);
    assert.ok(fs.existsSync(path.join(root, 'Essay/source')));
});

test('채우지 않은 템플릿과 누락된 링크는 공개 검증을 통과하지 못한다', async (t) => {
    const root = fixture(t);
    createDeck({ root, slug: 'Lesson', title: '초안' });
    await validateSite({ root, slug: 'Lesson' });
    await assert.rejects(validateSite({ root, slug: 'Lesson', forPublication: true }), /임시 내용/);
    const file = path.join(root, 'Lesson/index.html');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replaceAll(' data-template-placeholder', '').replace('</body>', '<img src="assets/missing.png" alt="없는 이미지"></body>'));
    await assert.rejects(validateSite({ root, slug: 'Lesson', forPublication: true }), /링크 없음/);
});

test('잘못된 상태와 날짜를 거부한다', (t) => {
    const root = fixture(t);
    fs.writeFileSync(path.join(root, 'decks.json'), JSON.stringify([{ slug: 'Invalid', title: '검사', status: 'unknown' }]));
    assert.throws(() => readProject(root), /상태/);
    fs.writeFileSync(path.join(root, 'decks.json'), JSON.stringify([{ slug: 'Invalid', title: '검사', status: 'draft', date: '2026-02-30' }]));
    assert.throws(() => readProject(root), /날짜/);
});

test('공개 페이지에서 비공개 원본으로 향하는 링크를 거부한다', async (t) => {
    const root = fixture(t);
    createDeck({ root, slug: 'Lesson', title: '발표 자료' });
    fs.writeFileSync(path.join(root, 'Lesson/source/original.txt'), '원본');
    const file = path.join(root, 'Lesson/index.html');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replaceAll(' data-template-placeholder', '').replace('</body>', '<a href="source/original.txt">원본</a></body>'));
    await assert.rejects(validateSite({ root, slug: 'Lesson', forPublication: true }), /배포에서 제외/);
});

test('서로 다른 테마와 페이지 수의 자료를 PDF·배포·브라우저까지 처리한다', { timeout: 120_000 }, async (t) => {
    const root = fixture(t);
    createDeck({ root, slug: 'LightDeck', title: '자료 구성 예시', theme: 'light' });
    createDeck({ root, slug: 'DarkDeck', title: '발표 구성 예시', theme: 'dark' });
    createDeck({ root, slug: 'DraftDeck', title: '미공개 초안' });
    for (const slug of ['LightDeck', 'DarkDeck']) {
        const file = path.join(root, slug, 'index.html');
        let html = fs.readFileSync(file, 'utf8').replaceAll(' data-template-placeholder', '');
        if (slug === 'DarkDeck') html = html.replace(/<section class="slide" data-title="정리">[\s\S]*?<\/section>/, '');
        fs.writeFileSync(file, html);
    }
    const project = readProject(root);
    project.decks.filter((deck) => deck.slug !== 'DraftDeck').forEach((deck) => { deck.status = 'published'; });
    writeDecks(project, project.decks);
    const generated = await exportPdfs({ root });
    assert.deepEqual(generated.map((result) => [result.slug, result.pages]), [['LightDeck', 4], ['DarkDeck', 3]]);
    const built = await buildSite({ root });
    assert.equal(built.decks.length, 2);
    assert.ok(!fs.existsSync(path.join(built.output, 'DraftDeck')));
    assert.ok(!fs.existsSync(path.join(built.output, 'templates')));
    assert.ok(!fs.existsSync(path.join(built.output, 'LightDeck/source')));
    assert.equal(JSON.parse(fs.readFileSync(path.join(built.output, 'decks.json'), 'utf8')).length, 2);
    assert.match(fs.readFileSync(path.join(built.output, 'index.html'), 'utf8'), /DarkDeck\/downloads\/DarkDeck.pdf/);
    const checked = await qaSlides({ root, catalog: false });
    assert.deepEqual(checked.map((result) => result.slides), [4, 3]);
    const proof = path.join(ROOT, 'test-results', 'template-proof');
    fs.mkdirSync(proof, { recursive: true });
    for (const slug of ['LightDeck', 'DarkDeck']) {
        copyTree(path.join(root, 'test-results', slug), path.join(proof, slug));
        fs.copyFileSync(path.join(root, slug, 'downloads', slug + '.pdf'), path.join(proof, slug + '.pdf'));
    }
});
