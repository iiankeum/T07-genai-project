// 콜노트 데모 「준비 중」 안내 서버 — src/app/server.mjs 가 아직 없을 때 run-app.sh 가 띄운다.
import http from 'node:http';
import { readFileSync } from 'node:fs';

const port = Number(process.env.PORT || 5600);
const host = process.env.HOST || '127.0.0.1';
const page = readFileSync(new URL('./placeholder.html', import.meta.url));

http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true, app: 'placeholder' }));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(page);
}).listen(port, host, () => console.log(`placeholder listening on ${host}:${port}`));
