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
