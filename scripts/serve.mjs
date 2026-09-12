#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/project.mjs';
import { startServer } from './lib/server.mjs';

const root = process.argv.includes('--dist') ? path.join(ROOT, '_site') : ROOT;
if (!fs.existsSync(root)) throw new Error('npm run build를 먼저 실행하세요.');
const server = await startServer(root, Number(process.env.PPT_PORT || 4173));
console.log('205 자료실: ' + server.url + (root === ROOT ? ' (작업 폴더)' : ' (배포 결과)'));
