// Sort-only interpretation. Never rewrite due text or infer an uncertain delivery deadline.
const registered = new WeakSet();
export function dueSortKey(value, recordedAt) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const match = /^(\d{4}-\d{2}-\d{2}|오늘|내일)(?:\s+(\d{2}):(\d{2}))?$/.exec(text);
  if (!match) return null;
  let day = match[1];
  if (day === '오늘' || day === '내일') {
    // Require an actual offset-bearing call timestamp; never depend on current date or host timezone.
    if (typeof recordedAt !== 'string' || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(recordedAt)) return null;
    const base = Date.parse(recordedAt);
    if (!Number.isFinite(base)) return null;
    day = new Date(base + 9 * 3600000 + (day === '내일' ? 86400000 : 0)).toISOString().slice(0, 10);
  }
  const midnight = Date.parse(day + 'T00:00:00+09:00');
  if (!Number.isFinite(midnight) || new Date(midnight + 9 * 3600000).toISOString().slice(0,10) !== day) return null;
  if (match[2] !== undefined && (+match[2] > 23 || +match[3] > 59)) return null;
  // Empty time sorts before known times on the same day; it does NOT mean a midnight deadline.
  return day + 'T' + (match[2] === undefined ? '' : match[2] + ':' + match[3]);
}
export function registerDueSort(database) {
  if (registered.has(database)) return;
  database.function('ahcha_due_sort_v1', {deterministic:true}, dueSortKey);
  registered.add(database);
}
