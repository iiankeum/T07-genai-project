import test from 'node:test';
import assert from 'node:assert/strict';
import {dueSortKey} from '../lib/due-sort.mjs';
test('due sorting: explicit KST date and time, date-only is not midnight',()=>{
 assert.equal(dueSortKey('2026-11-20',null),'2026-11-20T');
 assert.equal(dueSortKey('2026-11-20 09:05',null),'2026-11-20T09:05');
 assert.ok(dueSortKey('2026-11-20') < dueSortKey('2026-11-20 00:00'));
});
test('relative dates anchor to recorded KST date, not current/server date',()=>{
 assert.equal(dueSortKey('오늘','2026-12-31T15:00:00Z'),'2027-01-01T');
 assert.equal(dueSortKey('내일 09:00','2026-12-31T15:00:00Z'),'2027-01-02T09:00');
 assert.equal(dueSortKey('내일','2024-02-28T14:00:00Z'),'2024-02-29T');
 assert.equal(dueSortKey('내일','2024-02-29T14:00:00Z'),'2024-03-01T');
});
test('uncertain, invalid, clock-only and unzoned anchors are unknown',()=>{
 for(const s of ['',null,'09:00','내일 오전','다음주','11/20','2026-02-29','2026-13-01','2026-11-20 24:00','2026-11-20 12:60','2026-11-20쯤','오늘 9:00','2026-11-20~2026-11-22'])
 assert.equal(dueSortKey(s,'2026-11-19T01:00:00Z'),null,String(s));
 assert.equal(dueSortKey('오늘','2026-11-19T01:00:00'),null);
 assert.equal(dueSortKey('내일','bad'),null);
});
