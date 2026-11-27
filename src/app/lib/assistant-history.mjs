// 통화 삭제 시 저장된 인용과 모델에 넘겼던 통화까지 같이 찾는다.
const HISTORY_EPOCH_KEY = 'assistant_history_epoch';

export function assistantHistoryEpoch(d) {
  return d.prepare('SELECT value FROM meta WHERE key = ?').get(HISTORY_EPOCH_KEY)?.value ?? '0';
}

export function purgeAssistantCallHistory(d, callIds) {
  const ids = JSON.stringify([...new Set(callIds)]);
  if (ids === '[]') return;
  d.prepare(`DELETE FROM assistant_threads
    WHERE EXISTS (
      SELECT 1 FROM json_each(assistant_threads.messages) AS message
      WHERE EXISTS (
        SELECT 1 FROM json_each(message.value, '$.contextCallIds') AS source
        WHERE source.value IN (SELECT value FROM json_each(?))
      ) OR EXISTS (
        SELECT 1 FROM json_each(message.value, '$.citations') AS citation
        WHERE json_extract(citation.value, '$.callId') IN (SELECT value FROM json_each(?))
      )
    )`).run(ids, ids);
  d.prepare(`INSERT INTO meta(key, value) VALUES (?, '1')
    ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1`).run(HISTORY_EPOCH_KEY);
}
