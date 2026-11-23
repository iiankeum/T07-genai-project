import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { notificationFeed } from '../lib/notification-feed.mjs';
const now = Date.parse('2026-11-19T15:00:00Z');
const prefs = { urgent: true, review: true, upload: true };
function fixture(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(`CREATE TABLE calls(id TEXT PRIMARY KEY, title TEXT, source TEXT, status TEXT, created_at TEXT);
    CREATE TABLE cards(call_id TEXT PRIMARY KEY, urgent INTEGER, status TEXT);
    CREATE TABLE notification_reads(user_id TEXT, notification_id TEXT, PRIMARY KEY(user_id,notification_id));`);
  function add(id, { age = 0, source = 'other', callStatus = 'ready', card, urgent = 0 } = {}) {
    db.prepare('INSERT INTO calls VALUES(?,?,?,?,?)').run(id, id, source, callStatus, new Date(now - age * 86_400_000).toISOString());
    if (card) db.prepare('INSERT INTO cards VALUES(?,?,?)').run(id, urgent, card);
  }
  return { db, add, list: (p=prefs, userId='u') => notificationFeed(db,{userId,prefs:p,now}) };
}
test('older open work survives newer irrelevant calls; upload window and no duplicate urgent', t => {
  const { add, list } = fixture(t);
  for(let i = 0; i < 40; i++) add('new-'+i,{card:'shipped'});
  add('old-urgent',{age:20,card:'draft',urgent:1});
  add('old-confirmed',{age:21,card:'confirmed',urgent:1});
  add('old-review',{age:19,card:'draft'});
  add('old-upload',{age:8,source:'upload'});
  add('recent-upload',{source:'upload',callStatus:'failed'});
  add('queued-upload',{source:'upload',callStatus:'queued'});
  const {items,unread} = list();
  assert.deepEqual(items.map(i=>i.id),['urgent:old-confirmed:confirmed','review:old-review:draft','upload:recent-upload:failed','urgent:old-urgent:draft']);
  assert.equal(unread, 4);
});
test('cap shares room across types, user preferences and read partition are isolated', t => {
  const { db,add,list } = fixture(t);
  for(let i=0;i<40;i++) {
    add('u'+i,{age:40-i,card:'draft',urgent:1});
    add('r'+i,{age:40-i,card:'draft'});
    add('f'+i,{source:'upload'});
  }
  assert.equal(list().items.length,30);
  assert.deepEqual(new Set(list().items.map(i=>i.kind)),new Set(['urgent','review','upload']));
  db.prepare('INSERT INTO notification_reads VALUES(?,?)').run('u','urgent:u0:draft');
  assert.equal(list({urgent:true}).items[0].id,'urgent:u1:draft');
  assert.equal(list({urgent:true},'other').items[0].id,'urgent:u0:draft');
  assert.ok(list({review:true}).items.every(i=>i.kind==='review'));
});
