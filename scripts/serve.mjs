#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PPT_PORT || 4173);
const mime = {
    '.css': 'text/css; charset=utf-8',
    '.ent': 'application/octet-stream',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml; charset=utf-8',
};

const server = http.createServer((request, response) => {
    try {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        let target = path.resolve(root, `.${pathname}`);
        if (!target.startsWith(`${root}${path.sep}`) && target !== root) throw new Error('outside root');
        if (target.includes(`${path.sep}.git${path.sep}`)) throw new Error('private path');
        if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
        if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
            response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('404');
            return;
        }
        response.writeHead(200, {
            'Content-Type': mime[path.extname(target).toLowerCase()] || 'application/octet-stream',
            'Cache-Control': 'no-cache',
        });
        fs.createReadStream(target).pipe(response);
    } catch {
        response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('403');
    }
});

server.listen(port, '127.0.0.1', () => {
    console.log(`PPT 205: http://127.0.0.1:${port}`);
});
