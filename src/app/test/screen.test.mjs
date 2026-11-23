// 화면(public/js) 쪽 순수 도우미 시험: 주소 풀기(routeOf · safeDecode) · 부품 줄 「AI 초안 / 고침」 표시(itemMark).
// DOM 을 건드리지 않는 함수만 부른다(ui.js · call-util.js 는 Node 에서도 불러올 수 있다).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { routeOf, safeDecode } = await import('../public/js/ui.js');
const { itemMark, sameItem } = await import('../public/js/pages/call-util.js');

// app.js 의 ROUTES 가운데 시험에 필요한 것만 같은 모양으로
const ROUTES = [
  { re: /^\/?$/, page: 'today' },
  { re: /^\/calls$/, page: 'calls' },
  { re: /^\/calls\/([^/]+)$/, page: 'call', keys: ['id'] },
  { re: /^\/customers\/([^/]+)$/, page: 'customer', keys: ['name'] },
];

test('routeOf: 이름에 / 가 든 거래처(%2F)도 거래처 화면으로 열린다', () => {
  const r = routeOf('#/customers/' + encodeURIComponent('A/S 공업사'), ROUTES);
  assert.equal(r.page, 'customer');
  assert.equal(r.params.name, 'A/S 공업사');
});

test('routeOf: 한글 이름 · 물음 값', () => {
  const r = routeOf('#/customers/' + encodeURIComponent('한성정비'), ROUTES);
  assert.deepEqual([r.page, r.params.name], ['customer', '한성정비']);
  const c = routeOf('#/calls/fx-c01?t=12.5&seg=3', ROUTES);
  assert.deepEqual([c.page, c.params.id, c.query.t, c.query.seg], ['call', 'fx-c01', '12.5', '3']);
});

test('routeOf: 깨진 %xx 는 원문 그대로 두고 화면은 연다', () => {
  const r = routeOf('#/customers/%E0%A4%A', ROUTES);
  assert.equal(r.page, 'customer');
  assert.equal(r.params.name, '%E0%A4%A');
  assert.equal(safeDecode('%E0%A4%A'), '%E0%A4%A');
  assert.equal(safeDecode('A%2FS'), 'A/S');
});

test('routeOf: 빈 해시는 첫 화면, 칸이 더 많은 주소는 없는 화면', () => {
  assert.equal(routeOf('', ROUTES).page, 'today');
  assert.equal(routeOf('#/', ROUTES).page, 'today');
  assert.equal(routeOf('#/customers/A/S', ROUTES).page, 'notfound');
});

test('itemMark: AI 초안과 같은 줄은 「AI 초안」, 고친 줄 · 새 줄은 「고침」', () => {
  const draft = [
    { part: '앞 브레이크 패드', side: null, qty: 1, partNo: null },
    { part: '와이퍼', side: '운전석', qty: 2, partNo: null },
  ];
  // 화면 줄은 빈칸이 '' 로 온다(cloneItems) — null 과 같게 본다
  assert.equal(itemMark(draft, { part: '앞 브레이크 패드', side: '', qty: 1, partNo: '' }), 'ai');
  assert.equal(itemMark(draft, { part: '와이퍼', side: '운전석', qty: 3, partNo: '' }), 'edited');
  assert.equal(itemMark(draft, { part: '와이퍼', side: '운전석', qty: 2, partNo: '58411-S8000' }), 'edited');
  assert.equal(itemMark(draft, { part: '사이드미러', side: '', qty: 1, partNo: '' }), 'edited');
  // 앞 줄을 지워 번호가 당겨져도 초안 어느 줄과 같으면 AI 초안
  assert.equal(itemMark(draft, { part: '와이퍼', side: '운전석', qty: 2, partNo: '' }), 'ai');
  // 아직 아무것도 안 쓴 새 줄 · 초안이 없는 카드는 표시 없음
  assert.equal(itemMark(draft, { part: '', side: '', qty: 1, partNo: '' }), null);
  assert.equal(itemMark(null, { part: '앞범퍼', qty: 1 }), null);
  assert.equal(itemMark([], { part: '앞범퍼', qty: 1 }), 'edited');
});

test('sameItem: 수량은 숫자로, 글은 앞뒤 빈칸을 빼고 비교', () => {
  assert.equal(sameItem({ part: '앞범퍼', qty: '2' }, { part: ' 앞범퍼 ', qty: 2 }), true);
  assert.equal(sameItem({ part: '앞범퍼', qty: 1 }, { part: '앞범퍼', qty: null }), false);
  assert.equal(sameItem({ part: '앞범퍼', part_no: '86511' }, { part: '앞범퍼', partNo: '86511' }), true);
});
