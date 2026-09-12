#!/usr/bin/env node
import { cliSlug } from './lib/project.mjs';
import { validateSite } from './lib/validate.mjs';

try {
    const result = await validateSite({ slug: cliSlug(), requirePdfs: process.argv.includes('--pdf') });
    const slides = Object.entries(result.countByDeck).map(([slug, count]) => slug + ' ' + count + '장').join(', ');
    console.log('검증 통과: 자료 ' + result.decks + '개, 내부 참조 ' + result.links + '개 (' + slides + ')');
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
