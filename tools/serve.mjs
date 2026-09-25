// Minimal static file server for local preview and headless rendering.
import { fileURLToPath } from 'url';
import http from 'http';
import fs from 'fs';
import path from 'path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.mp3': 'audio/mpeg', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.mp4': 'video/mp4',
};

export function serve(root, port = 0) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(root, url === '/' ? 'index.html' : url);
    if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.stat(file, (err, st) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      const type = TYPES[path.extname(file)] || 'application/octet-stream';
      const range = req.headers.range;
      if (range) {
        const [a, b] = range.replace('bytes=', '').split('-');
        const start = Number(a), end = b ? Number(b) : st.size - 1;
        res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
        fs.createReadStream(file, { start, end }).pipe(res);
      } else {
        res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
        fs.createReadStream(file).pipe(res);
      }
    });
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok({ server, port: server.address().port })));
}

if (process.argv[1] && process.argv[1].endsWith('serve.mjs')) {
  const port = Number(process.argv[2] || 8787);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  serve(root, port).then(({ port }) => console.log(`http://127.0.0.1:${port}/`));
}
