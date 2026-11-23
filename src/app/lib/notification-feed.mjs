// Workspace database only. Apply each category's filter before the cap.
const DAY = 86_400_000;
export const FEED_LIMIT = 30;
const snapshots = [
  ['urgent', "k.urgent = 1 AND k.status IN ('draft','confirmed')", 'ASC'],
  ['review', "k.status = 'draft' AND COALESCE(k.urgent,0) = 0", 'ASC'],
  ['upload', "c.source = 'upload' AND c.status IN ('ready','failed') AND c.created_at >= ?", 'DESC'],
];

export function notificationFeed(d, { userId, prefs, now = Date.now() }) {
  const lists = [];
  for (const [kind, where, direction] of snapshots) {
    if (!prefs[kind]) continue;
    const idStatus = kind === 'upload' ? 'c.status' : 'k.status';
    const q = d.prepare(`SELECT c.id, c.title, c.status, c.created_at,
        ${kind === 'upload' ? 'c.status' : 'k.status'} AS id_status,
        EXISTS(SELECT 1 FROM notification_reads n
          WHERE n.user_id = ? AND n.notification_id = ? || ':' || c.id || ':' || ${idStatus}) AS was_read
      FROM calls c LEFT JOIN cards k ON k.call_id = c.id
      WHERE ${where}
      ORDER BY was_read ASC, c.created_at ${direction}, c.id ${direction} LIMIT ?`);
    const params = [userId, kind];
    if (kind === 'upload') params.push(new Date(now - 7 * DAY).toISOString());
    lists.push({ kind, rows: q.all(...params, FEED_LIMIT) });
  }
  const items = [];
  for (const read of [false, true]) {
    const buckets = lists.map(({ kind, rows }) => ({ kind, rows: rows.filter(row => Boolean(row.was_read) === read) }));
    for (let i = 0; i < FEED_LIMIT && items.length < FEED_LIMIT; i += 1) {
      if (!buckets.some(b => b.rows[i])) break;
      for (const { kind, rows } of buckets) {
        const row = rows[i];
        if (!row || items.length >= FEED_LIMIT) continue;
        const message = kind === 'urgent' ? '급한 주문의 다음 단계를 확인해 주세요.'
          : kind === 'review' ? '주문 카드 확인이 필요해요.'
          : row.status === 'ready' ? '올린 녹음 정리가 끝났어요.' : '올린 녹음을 정리하지 못했어요.';
        items.push({ id: `${kind}:${row.id}:${row.id_status}`, callId: row.id, kind,
          title: row.title ?? '통화', message, createdAt: row.created_at, read });
      }
    }
  }
  return { items, unread: items.filter(item => !item.read).length };
}
