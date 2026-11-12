// [A] 시험 도우미: 시험용 WAV 를 코드로 만들고(저장소에 오디오 파일을 넣지 않는다), 라우트 하나만 단 서버를 띄운다.
import http from 'node:http';

/** 사인파 WAV (16bit PCM). freq 를 바꾸면 내용(SHA-256)이 달라진다. */
export function makeWav(sec, { rate = 16000, channels = 1, freq = 440 } = {}) {
  const n = Math.round(sec * rate);
  const data = Buffer.alloc(n * channels * 2);
  for (let i = 0; i < n; i += 1) {
    const v = Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 8000);
    for (let c = 0; c < channels; c += 1) data.writeInt16LE(v, (i * channels + c) * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0, 'latin1');
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8, 'latin1');
  h.write('fmt ', 12, 'latin1');
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * channels * 2, 28);
  h.writeUInt16LE(channels * 2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36, 'latin1');
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/** 라우트 모듈들만 단 서버(임의 포트). { base, close } */
export async function startServer(modules) {
  const { Router } = await import('../../lib/http.mjs');
  const { createApp } = await import('../../server.mjs');
  const router = new Router();
  for (const m of modules) m.register(router);
  const server = http.createServer(createApp(router));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(() => r()); }),
  };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
