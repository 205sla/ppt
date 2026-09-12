#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { lessonProjects } from './ease-lab-spec.mjs';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const myEntryRoot = process.env.MYENTRY_ROOT || 'C:/Users/young/prg/ENTRY/apps/MYentry-game';
const outputDir = path.resolve(here, '../../downloads');
const allowOverwrite = process.argv.includes('--force');
const { validateSpec, writeEnt } = await import(
    url.pathToFileURL(path.join(myEntryRoot, 'tools/make-ent.mjs'))
);

fs.mkdirSync(outputDir, { recursive: true });

for (const project of lessonProjects) {
    const issues = validateSpec(project.spec);
    const errors = issues.filter((issue) => issue.severity === 'error');
    if (errors.length) {
        throw new Error(`${project.file}: ${errors.map((issue) => `${issue.path} ${issue.msg}`).join(' | ')}`);
    }

    const destination = path.join(outputDir, project.file);
    if (fs.existsSync(destination) && !allowOverwrite) {
        throw new Error(`${destination} 파일이 이미 있습니다. 새 번호를 쓰거나 --force로 재생성하세요.`);
    }
    const result = await writeEnt(project.spec, destination);
    console.log(`${project.file}  ${result.size} bytes  ${result.objectCount} objects`);
}
