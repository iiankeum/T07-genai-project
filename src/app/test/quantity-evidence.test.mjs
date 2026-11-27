// 모두 가짜 주문/합성음성 재현값. 실모델을 호출하지 않는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contradictoryQuantityEvidence as check } from '../lib/quantity-evidence.mjs';
test('가짜 실모델 재현: 최종 수량3과 이전 두 개 인용의 모순을 표시한다', () => {
 assert.equal(check({part:'아반대 시앤치랍범퍼',qty:3,quote:'아반대 시앤치랍범퍼 두 개, 22년씩 맞으시죠?'}),2);
});
test('일치·다른 품목·복수 수량·묶음·정정·범위·모호한 수량은 추측하지 않는다', () => {
 for(const quote of ['패드 세 개','디스크 두 개','패드 두 개, 디스크 세 개','패드 두 세트','패드 두 개 말고 세 개','패드 두 개 정도','패드 한두 개','패드 스물두 개','패드 2~3개','패드']) assert.equal(check({part:'패드',qty:3,quote}),null,quote);
 assert.equal(check({part:'패드',qty:3,quote:'패드 2개'}),2);
});

test('품목명과 개 단위의 경계를 보존한다', () => {
 for (const quote of ['패드 2개월','패드 2개국','패드 2개씩','패드 2개입','뒷패드 두 개','앞패드 2개','rear패드 2개']) assert.equal(check({part:'패드',qty:3,quote}),null,quote);
 for (const quote of ['패드 2개','패드 두 개요.','패드 두 개로 주세요.','패드 두 개, 맞죠?']) assert.equal(check({part:'패드',qty:3,quote}),2,quote);
});

test('한 품목의 바로 다음 정확한 정정만 새 원문으로 사용', async () => {
  const { adjacentQuantityCorrection } = await import('../lib/quantity-evidence.mjs');
  const row = { part:'앞 범퍼',qty:3,quote:'앞 범퍼 두 개 주세요.',at:1,seg:0 };
  const first = { text:row.quote,start:1,end:3,speaker:'고객' };
  const next = text=>({ text,start:4,end:7,speaker:'고객' });
  const find=(text, options={})=>adjacentQuantityCorrection({row,originalQty:2,itemCount:1,segments:[first,next(text)],...options});
  for(const text of ['아, 두 개 말고 세 개로 해주세요.','아 아니다. 세 개로 해주세요.','아니요, 세 개로 주세요.']) {
    assert.deepEqual(find(text),{quote:text,at:4,seg:1},text);
  }
  for(const text of ['한 개 말고 세 개로 해주세요.','두 개 말고 네 개로 해주세요.','디스크 세 개로 해주세요.','아니요, 세 개랑 디스크 네 개 주세요.','아니요, 세 개 정도 부탁해요.','두 개 말고 세 개로 해주세요. 취소.']) assert.equal(find(text),null,text);
  assert.equal(find('아니요, 세 개로 주세요.',{itemCount:2}),null);
  assert.equal(find('아니요, 세 개로 주세요.',{row:{...row,partNo:'1234-A'}}),null);
  assert.equal(find('아니요, 세 개로 주세요.',{segments:[first,{...next('아니요, 세 개로 주세요.'),speaker:'상담원'}]}),null);
  assert.equal(find('아니요, 세 개로 주세요.',{segments:[first,{...next('아니요, 세 개로 주세요.'),start:30,end:31}]}),null);
  assert.equal(find('아니요, 세 개로 주세요.',{segments:[first,next('아니요, 세 개로 주세요.'),{start:8,end:9,text:'결국 네 개로 할게요.'}]}),null);
});
