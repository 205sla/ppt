import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SLUG_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
const reserved = new Set(['shared', 'scripts', 'templates', 'tests', 'docs', 'schema', 'assets', 'node_modules', 'test-results', 'downloads', 'con', 'prn', 'aux', 'nul', ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`), ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`)]);

export function assertSlug(slug) {
    if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug) || reserved.has(slug.toLowerCase())) {
        throw new Error(`폴더명 오류: ${slug}. 영문으로 시작하고 영문·숫자·하이픈·밑줄만 사용하세요. 공통 폴더명은 사용할 수 없습니다.`);
    }
}

export function readProject(root = ROOT) {
    const config = JSON.parse(fs.readFileSync(path.join(root, 'site.config.json'), 'utf8'));
    const siteUrl = new URL(process.env.SITE_URL || config.url);
    if (!['http:', 'https:'].includes(siteUrl.protocol) || siteUrl.search || siteUrl.hash) throw new Error('site.config.json의 url은 HTTP(S) 사이트 주소여야 합니다.');
    if (!siteUrl.pathname.endsWith('/')) siteUrl.pathname += '/';
    if (!config.title || !config.defaultCategory || !['light', 'dark'].includes(config.defaultTheme)) throw new Error('사이트 제목, 기본 분류와 테마(light/dark)를 확인하세요.');
    const decks = JSON.parse(fs.readFileSync(path.join(root, 'decks.json'), 'utf8'));
    if (!Array.isArray(decks)) throw new Error('decks.json은 자료 목록 배열이어야 합니다.');
    const seen = new Set();
    for (const deck of decks) {
        assertSlug(deck.slug);
        if (seen.has(deck.slug.toLowerCase())) throw new Error(`폴더명 중복: ${deck.slug} (대소문자도 구분하지 않습니다)`);
        seen.add(deck.slug.toLowerCase());
        if (typeof deck.title !== 'string' || !deck.title.trim()) throw new Error(`${deck.slug}: 제목이 없습니다.`);
        if (!['draft', 'published'].includes(deck.status || 'published')) throw new Error(`${deck.slug}: 상태는 draft 또는 published여야 합니다.`);
        for (const field of ['category', 'description', 'meta']) {
            if (deck[field] !== undefined && typeof deck[field] !== 'string') throw new Error(`${deck.slug}: ${field}는 문자열이어야 합니다.`);
        }
        if (deck.date && (!/^\d{4}-\d{2}-\d{2}$/.test(deck.date) || Number.isNaN(Date.parse(deck.date)) || new Date(deck.date).toISOString().slice(0, 10) !== deck.date)) {
            throw new Error(`${deck.slug}: 날짜는 유효한 YYYY-MM-DD 형식이어야 합니다.`);
        }
    }
    return { root: path.resolve(root), config: { ...config, url: siteUrl.href }, decks };
}

export function selectDecks(project, slug) {
    if (!slug) return project.decks.filter((deck) => (deck.status || 'published') === 'published');
    assertSlug(slug);
    const deck = project.decks.find((item) => item.slug === slug);
    if (!deck) throw new Error(`등록되지 않은 자료: ${slug}. npm run deck:list로 폴더명을 확인하세요.`);
    return [deck];
}

export function writeDecks(project, decks) {
    const file = path.join(project.root, 'decks.json');
    const temporary = `${file}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(decks, null, 2)}\n`, { flag: 'wx' });
    try { fs.renameSync(temporary, file); }
    catch (error) { fs.unlinkSync(temporary); throw error; }
}

export function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

export function walk(directory, excluded = new Set(['node_modules', '.git', 'source'])) {
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        if (excluded.has(entry.name) || entry.name.startsWith('.')) return [];
        const file = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) throw new Error(`공개 자료에는 심볼릭 링크를 넣지 마세요: ${file}`);
        return entry.isDirectory() ? walk(file, excluded) : [file];
    });
}

export function cliSlug(args = process.argv.slice(2)) {
    if (args.some((arg) => arg.startsWith('--') && arg !== '--pdf')) throw new Error('알 수 없는 옵션입니다. 자료 폴더명만 지정하세요.');
    const positional = args.filter((arg) => !arg.startsWith('--'));
    if (positional.length > 1) throw new Error('자료 폴더명은 하나만 지정하세요. 생략하면 공개 자료 전체를 처리합니다.');
    return positional[0];
}
