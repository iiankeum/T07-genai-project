import { purgeAssistantCallHistory } from './assistant-history.mjs';
import { detachKnowledgeCallSources } from './knowledge.mjs';

/** 통화를 지우는 트랜잭션 안에서 통화에서 가져온 기록도 함께 정리한다. */
export function purgeCallReferences(d, callIds) {
  if (!callIds.length) return;
  purgeAssistantCallHistory(d, callIds);
  detachKnowledgeCallSources(d, callIds);
  const removeAudit = d.prepare("DELETE FROM audit_log WHERE entity IN ('call','card') AND entity_id = ?");
  for (const id of callIds) removeAudit.run(id);
  d.prepare('DELETE FROM briefings').run();
  d.prepare('DELETE FROM recommendations').run();
}
