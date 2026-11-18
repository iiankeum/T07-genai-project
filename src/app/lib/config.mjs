// 환경변수를 한곳에서 읽는다. 비밀값(키·토큰·암호)은 이 모듈 밖으로 값 그대로 내보내지 않고,
// 필요한 모듈이 secret() 으로만 꺼내 쓴다. 로그·응답에 비밀값을 넣지 않는다.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const REPO_DIR = path.resolve(APP_DIR, '..', '..');

const env = process.env;
const str = (v, d = '') => (typeof v === 'string' && v.trim() !== '' ? v.trim() : d);
const int = (v, d) => (Number.isFinite(Number(v)) && String(v).trim() !== '' ? Number(v) : d);

function readCommit() {
  const fromEnv = str(env.GIT_COMMIT) || str(env.COMMIT_SHA) || str(env.SOURCE_VERSION);
  if (fromEnv) return fromEnv.slice(0, 40);
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: APP_DIR, stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 })
      .toString().trim();
  } catch {
    // .git 이 없는 배포본이면 REVISION 파일을 본다
    for (const f of [path.join(APP_DIR, 'REVISION'), path.join(REPO_DIR, 'REVISION')]) {
      try { if (existsSync(f)) return readFileSync(f, 'utf8').trim().slice(0, 40); } catch { /* 없음 */ }
    }
    return 'unknown';
  }
}

const SECRETS = {
  ANTHROPIC_API_KEY: str(env.ANTHROPIC_API_KEY),
  WORKER_TOKEN: str(env.WORKER_TOKEN),
  INGEST_TOKEN: str(env.INGEST_TOKEN),
  ADMIN_PASSCODE: str(env.ADMIN_PASSCODE),
  AWS_ACCESS_KEY_ID: str(env.AWS_ACCESS_KEY_ID),
  AWS_SECRET_ACCESS_KEY: str(env.AWS_SECRET_ACCESS_KEY),
};

/** 비밀값 꺼내기. 값이 없으면 ''. 절대 로그·응답에 넣지 않는다. */
export function secret(name) {
  return SECRETS[name] ?? '';
}
export function hasSecret(name) {
  return Boolean(SECRETS[name]);
}

const dataDirDefault = path.join(APP_DIR, '.data');

export const config = Object.freeze({
  port: int(env.PORT, 5600),
  host: str(env.HOST, '127.0.0.1'),
  dataDir: path.resolve(str(env.DATA_DIR, dataDirDefault)),
  publicBaseUrl: str(env.PUBLIC_BASE_URL, '').replace(/\/+$/, ''),
  s3Bucket: str(env.S3_BUCKET),
  awsRegion: str(env.AWS_REGION, 'ap-northeast-2'),
  commit: readCommit(),
  startedAt: new Date().toISOString(),
  // Claude 모델. 기본은 claude-opus-5-5 (claude-api 스킬 기본값). 바꾸려면 CLAUDE_MODEL.
  model: str(env.CLAUDE_MODEL, 'claude-opus-5-5'),
  // 공개 데모: 가짜 통화만 받는다
  demoMode: str(env.DEMO_MODE, '1') !== '0',
  // 돈이 드는 동작의 하루 전체 상한
  dailyAiLimit: int(env.DAILY_AI_LIMIT, 400),
  dailyUploadLimit: int(env.DAILY_UPLOAD_LIMIT, 100),
  maxUploadBytes: int(env.MAX_UPLOAD_BYTES, 10 * 1024 * 1024),
  maxAudioSec: int(env.MAX_AUDIO_SEC, 300),
  ffmpegPath: str(env.FFMPEG_PATH, 'ffmpeg'),
  ffprobePath: str(env.FFPROBE_PATH, 'ffprobe'),
  workerOnlineSec: 60,
  jobLeaseSec: 600,
  jobMaxAttempts: 3,
  trustProxy: str(env.TRUST_PROXY, '1') !== '0',
});

export function dataDirWritable() {
  try { return statSync(config.dataDir).isDirectory(); } catch { return false; }
}
