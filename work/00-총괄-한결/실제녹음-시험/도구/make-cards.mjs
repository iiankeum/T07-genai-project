// 이미 받아쓴 통화를 아차 v1.6 의 카드 정리 코드(lib/pipeline.mjs 의 resumeStuck)로 차례로 정리한다.
// 서버가 다시 뜰 때 「카드 정리 중」에 멈춘 통화를 정리하는 그 길을 그대로 쓴다. 한 번에 하나씩이라 PC 안 모델이 밀리지 않는다.
// 통화 내용은 출력하지 않는다(건수 · 걸린 시간만).
// 쓰는 법(서버를 끈 상태에서, 시험 서버와 같은 설정 파일로):
//   node --env-file=<AI_PROVIDER=ollama 인 서버 설정 파일> make-cards.mjs [앞의 N건만] [--dry-run]
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { appDir, workspaceId } from './_paths.mjs';

const app = appDir();
const mod = (p) => import(pathToFileURL(path.join(app, p)).href);
const { withWorkspace, db } = await mod('lib/db.mjs');
const { machineWorkspace } = await mod('lib/auth.mjs');
const { resumeStuck } = await mod('lib/pipeline.mjs');
const { config } = await mod('lib/config.mjs');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limit = Number(args.find((a) => /^\d+$/.test(a)) || 0) || Infinity;
const chunk = 5;
console.log(`provider=${config.aiProvider} model=${config.ollamaModel}`);

await withWorkspace(machineWorkspace(workspaceId()), async () => {
  // 받아쓰기는 끝났는데 AI 카드가 아직 없는 통화만 고른다(이미 만든 카드는 건드리지 않는다).
  const todo = db().prepare(`SELECT c.id FROM calls c JOIN cards k ON k.call_id = c.id
    WHERE c.status = 'ready' AND k.status = 'draft' AND k.ai_model IS NULL
      AND LENGTH(TRIM(COALESCE(c.transcript, ''))) > 0
    ORDER BY c.created_at`).all().map((r) => r.id).slice(0, limit);
  console.log(`대상 ${todo.length}건`);
  if (dryRun) return;
  const mark = db().prepare("UPDATE calls SET status = 'extracting' WHERE id = ?");
  const t0 = Date.now();
  let done = 0;
  for (let i = 0; i < todo.length; i += chunk) {
    const part = todo.slice(i, i + chunk);
    for (const id of part) mark.run(id);
    const t = Date.now();
    await resumeStuck();
    done += part.length;
    console.log(`${done}/${todo.length} · 이번 ${part.length}건 ${((Date.now() - t) / 1000).toFixed(1)}초 · 누적 ${((Date.now() - t0) / 60000).toFixed(1)}분`);
  }
});
console.log('끝');
