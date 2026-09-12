#!/usr/bin/env node
import { ROOT, readProject, selectDecks, writeDecks } from './lib/project.mjs';
import { validateSite } from './lib/validate.mjs';

const [command = 'list', slug] = process.argv.slice(2);
try {
    const project = readProject();
    if (command === 'list') {
        for (const deck of project.decks) console.log(`${(deck.status || 'published') === 'published' ? '공개' : '초안'}\t${deck.slug}\t${deck.category || project.config.defaultCategory}\t${deck.title}`);
    } else if (['publish', 'draft'].includes(command) && slug) {
        const [deck] = selectDecks(project, slug);
        if (command === 'publish') await validateSite({ root: ROOT, slug, forPublication: true });
        deck.status = command === 'publish' ? 'published' : 'draft';
        writeDecks(project, project.decks);
        console.log(`${slug}: ${command === 'publish' ? '공개 대상' : '초안'}으로 설정했습니다. 실제 사이트에는 다음 빌드·푸시 후 반영됩니다.`);
    } else throw new Error('deck:list, deck:publish -- Folder, deck:draft -- Folder 중 하나를 사용하세요.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
