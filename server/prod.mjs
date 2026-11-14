import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachGameServer } from './gameServer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

let apiMiddlewareRef = null;

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname.startsWith('/api/') && apiMiddlewareRef) {
    await apiMiddlewareRef(req, res, () => {
      res.statusCode = 404;
      res.end('Not found');
    });
    return;
  }

  let relPath = decodeURIComponent(url.pathname);
  if (relPath === '/') relPath = '/index.html';

  const filePath = path.resolve(distDir, `.${relPath}`);
  if (!filePath.startsWith(distDir)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  let target = filePath;
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    const fallback = path.join(distDir, 'index.html');
    if (fs.existsSync(fallback)) {
      target = fallback;
    } else {
      res.statusCode = 404;
      res.end('Build not found. Execute "npm run build" first.');
      return;
    }
  }

  try {
    const data = await fsp.readFile(target);
    const ext = path.extname(target).toLowerCase();
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
    if (target.endsWith('sw.js') || target.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
    res.end(data);
  } catch (err) {
    console.error('[Prod Server Error]', err);
    res.statusCode = 500;
    res.end('Internal server error');
  }
});

const gameServer = attachGameServer(null, httpServer);
apiMiddlewareRef = gameServer.apiMiddleware;

const port = Number(process.env.PORT || 4173);
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`AnimeKombat rodando em http://0.0.0.0:${port}`);
});

