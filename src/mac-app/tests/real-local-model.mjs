// 가짜 입력만 사용하는 수동 실모델 검증. 유료 API·다운로드·운영 자료를 사용하지 않는다.
import assert from 'node:assert/strict';
import { ollamaJson } from '../../app/lib/ai-ollama.mjs';
if (!process.argv.includes('--run-real-local-model')) {
  throw new Error('로컬 Ollama를 준비한 뒤 --run-real-local-model로 명시적으로 실행하세요.');
}
const started = Date.now();
const result = await ollamaJson({
  model: 'qwen3:4b',
  system: '주어진 가짜 주문에서 부품명과 개수만 추출하세요. 제공되지 않은 값은 추측하지 마세요.',
  user: '테스트용 가짜 통화: 앞 브레이크 패드 1세트와 앞 디스크 2개 부탁합니다.',
  schema: {type:'object', properties:{items:{type:'array',items:{type:'object',properties:{name:{type:'string'},quantity:{type:'integer'}},required:['name','quantity'],additionalProperties:false}}},required:['items'],additionalProperties:false},
  maxTokens: 256, timeoutMs: 120000,
});
assert.equal(result.model, 'qwen3:4b');
assert.equal(result.data.items.length, 2);
assert.ok(result.data.items.some(x => x.name.includes('패드') && x.quantity === 1));
assert.ok(result.data.items.some(x => x.name.includes('디스크') && x.quantity === 2));
console.log(JSON.stringify({at:new Date().toISOString(), syntheticInput:true, realInference:true, provider:'ollama',
  elapsedMs:Date.now()-started, ...result}, null, 2));
