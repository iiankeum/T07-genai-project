// 도움말: 이 데모가 무엇인지 · 기능 목록(F01~F15) · 데이터가 어디로 가는지 · 홈 화면에 추가 · 큰 글씨.
import { api } from '../api.js';
import { html, render } from '../ui.js';
import { customerHref } from './board.js';

// [ID, 이름, 해 보는 곳(해시 주소 · null 이면 「글씨 크게」 단추), 해 보는 곳 이름, 한 줄 설명]
const FEATURES = [
  ['F01', '녹음 올리기', '#/upload', '녹음 올리기', '가짜 녹음 파일(m4a · mp3 · wav)을 올리면 받아쓰기 줄에 들어가고, 다 되면 「확인 필요」 카드가 됩니다.'],
  ['F02', '받아쓰기(통화 글)', '#/calls', '통화 기록', '통화를 문장마다 시각이 붙은 글로 읽습니다. 문장을 누르면 그 대목부터 녹음이 나옵니다.'],
  ['F03', '실시간 받아쓰기 체험', '#/live', '실시간 받아쓰기', '마이크에 대고 주문을 말하면 글이 써지고, 말을 멈추면 주문 카드가 채워집니다.'],
  ['F04', '주문 카드 자동 정리', '#/calls', '통화 하나 열기', 'AI 가 거래처 · 차 · 부품 · 수량 · 급함 · 되물을 것을 카드로 정리합니다. 고쳐 말한 수량은 마지막 값으로.'],
  ['F05', '근거 표시 · 들어 보기', '#/calls', '통화 하나 열기', '카드 칸을 누르면 그 말을 한 문장이 칠해지고 녹음이 그 시각부터 나옵니다. 틀렸을 수 있는 값엔 노란 「들어 보기」.'],
  ['F06', '카드 고치기 · 확정', '#/board', '주문 카드 보드', '틀린 칸만 고치고 확정합니다. 확인 필요 → 확정 → 출고 완료. 되물을 것이 남으면 확정이 막힙니다.'],
  ['F07', '낱말 사전', '#/glossary', '낱말 사전', '휀다 · 쇼바 같은 현장 말과 거래처 이름을 넣고 「다시 정리」하면 카드에 반영됩니다.'],
  ['F08', '통화 찾기', '#/calls', '통화 기록 · 찾기', '「쏘렌토」처럼 낱말로 찾고 날짜 · 거래처 · 상태로 거릅니다. 맞은 문장이 굵게 보입니다.'],
  ['F09', '지난 통화에 묻기', '#/ask', '지난 통화에 묻기', '사람에게 묻듯 물으면 저장된 통화만 근거로 답하고 근거 문장을 붙입니다. 없으면 「찾지 못했어요」.'],
  ['F10', '오늘 브리핑 · 할 일', '#/', '오늘 브리핑', '오늘 숫자 · 할 일 · 다시 전화할 곳 · AI 한 단락 요약, 그리고 마감 요약 복사.'],
  ['F11', '번호로 거래처 맞추기', '#/calls', '통화 하나 열기', '걸려 온 번호(가짜)가 거래처 목록에 있으면 카드의 거래처를 채우고 「번호로 확인」을 붙입니다.'],
  ['F12', '녹음 폴더 자동 보내기', '#/upload', '녹음 올리기 화면 안내', '대리점 PC 의 녹음 폴더에 새 파일이 생기면 작은 프로그램이 서버로 보냅니다.'],
  ['F13', '거래처별 모아 보기', '#/calls', '통화에서 거래처 이름 누르기', '한 정비소와의 통화 · 주문을 날짜별로 모아 봅니다.'],
  ['F14', '출고 목록 내보내기', '#/shipping', '출고 목록', '확정 주문을 거래처별로 묶어 인쇄하거나 CSV 로 내려받습니다.'],
  ['F15', '큰 글씨', null, '위 「글씨 크게」 단추', '누르면 모든 글씨가 커지고, 다시 열어도 그대로입니다.'],
];

export default {
  title: '도움말',
  async mount(el, ctx) {
    const ac = new AbortController();
    const st = { firstCustomer: null };
    render(el, html`<div class="page page-narrow help-page"></div>`);
    const root = el.firstElementChild;
    const alive = () => !ac.signal.aborted && root.isConnected;
    const meta = ctx.meta || {};

    function bigOn() { return document.documentElement.classList.contains('big-text'); }

    function featureRows() {
      return FEATURES.map(([id, name, link, where, desc]) => {
        let go;
        if (link === null) {
          go = html`<button type="button" class="btn help-go" data-act="big">${bigOn() ? '글씨 보통으로' : '지금 글씨 크게'}</button>`;
        } else if (id === 'F13' && st.firstCustomer) {
          go = html`<a class="btn help-go" href="${customerHref(st.firstCustomer)}">${st.firstCustomer} 모아 보기</a>`;
        } else {
          go = html`<a class="btn help-go" href="${link}">${where}</a>`;
        }
        return html`<tr>
          <th scope="row"><span class="help-fid">${id}</span><span class="help-fname">${name}</span></th>
          <td class="help-where">${go}</td>
          <td class="help-desc">${desc}</td>
        </tr>`;
      });
    }

    function draw() {
      if (!alive()) return;
      render(root, html`
        <div class="page-head"><div>
          <p class="eyebrow">도움말 · 가짜 통화 데모</p>
          <h1>이 데모 사이트 안내</h1>
          <p class="sub">콜노트(가칭)는 수업 팀 프로젝트로 만든 시험용 사이트입니다.</p>
        </div></div>

        <section class="card help-what" aria-labelledby="h-what">
          <h2 id="h-what">무엇을 하는 사이트인가요</h2>
          <p>자동차 부품 대리점에는 정비소(카센터)에서 부품 주문 전화가 하루 종일 걸려 옵니다. 이 사이트는 그 <strong>전화 주문을 글로 받아쓰고</strong>, 주문에 필요한 것만 뽑아 <strong>주문 카드</strong>로 정리합니다.</p>
          <ol class="help-flow">
            <li><span class="hf-n">1</span><span><strong>전화 녹음</strong>올리기 · 폴더 · 실시간</span></li>
            <li><span class="hf-n">2</span><span><strong>받아쓰기</strong>문장마다 시각이 붙은 통화 글</span></li>
            <li><span class="hf-n">3</span><span><strong>주문 카드</strong>AI 초안: 거래처 · 차 · 부품 · 수량 · 급함 · 되물을 것</span></li>
            <li><span class="hf-n">4</span><span><strong>사람이 확인 · 확정</strong>틀린 칸만 고치기</span></li>
            <li><span class="hf-n">5</span><span><strong>출고</strong>거래처별 출고 목록 · 인쇄</span></li>
          </ol>
          <p class="help-note">AI 는 초안을 만들 뿐이고, <strong>확정은 사람이 합니다.</strong> 품번은 통화에서 불러 준 것만 적고, AI 가 지어내지 않습니다. 비어 있으면 사람이 넣습니다.</p>
        </section>

        <div class="notice notice-warn help-fake" role="note">
          <strong>모든 통화는 가짜입니다.</strong> 화면의 거래처 · 사람 이름 · 차번호 · 전화번호 · 품번은 모두 지어낸 것입니다.
          <strong>실제 통화 녹음이나 실제 고객 정보는 올리지 마세요.</strong>
        </div>

        <section class="help-sec" aria-labelledby="h-feat">
          <h2 id="h-feat">기능 목록 (F01~F15)</h2>
          <div class="table-wrap help-table-wrap">
            <table class="table help-table">
              <thead><tr><th scope="col">기능</th><th scope="col">해 보기</th><th scope="col">한 줄 설명</th></tr></thead>
              <tbody>${featureRows()}</tbody>
            </table>
          </div>
        </section>

        <section class="card help-data" aria-labelledby="h-data">
          <h2 id="h-data">통화 내용은 어디로 가나요</h2>
          <p class="help-now">지금 상태: AI ${meta.aiEnabled ? '켜짐' : '꺼짐(키 없음)'} · 받아쓰기 일꾼 ${meta.worker?.online ? '켜짐' : '대기 중(꺼짐)'}</p>
          <ul class="help-list">
            <li><strong>받아쓰기(녹음 → 글)</strong>: 올린 녹음은 이 데모 서버에 저장되고, 팀의 GPU PC 에서 도는 <strong>Whisper 받아쓰기 일꾼</strong>이 서버에서 녹음을 가져가 글로 바꿉니다. 일꾼 PC 가 꺼져 있으면 위에 「대기 중」이 뜨고, 녹음은 줄을 서서 기다립니다. 그동안은 미리 받아쓴 가짜 통화로 다른 기능을 써 볼 수 있습니다.</li>
            <li><strong>주문 카드 · 오늘 요약 · 지난 통화에 묻기</strong>: 받아쓴 글을 Anthropic 사의 AI <strong>Claude</strong> 에 보내 처리합니다. Claude 는 <strong>해외 서버</strong>에서 돕니다. AI 를 부르는 일은 모두 이 사이트 서버가 하고, 휴대폰 · PC 에는 AI 열쇠(키)가 없습니다.</li>
            <li><strong>실시간 받아쓰기</strong>: 브라우저에 들어 있는 음성 인식 기능을 씁니다. 이때 <strong>말소리는 브라우저 회사(크롬이면 구글 등)의 서버</strong>로 보내져 글로 바뀝니다. 안 되는 브라우저에서는 샘플 대화를 재생해 같은 흐름을 보여 줍니다.</li>
            <li><strong>저장</strong>: 올린 원본 파일은 변환한 뒤 지우고, 받아쓰기용 음성 파일(16kHz WAV)만 남깁니다. 누가 올렸는지는 IP 주소를 알아볼 수 없게 바꾼 값으로만 남깁니다. 데모 데이터는 관리자가 초기화할 수 있습니다.</li>
          </ul>
        </section>

        <section class="card help-ai" aria-labelledby="h-ai">
          <h2 id="h-ai">AI 가 틀릴 수 있어요</h2>
          <ul class="help-list">
            <li>받아쓰기가 틀렸을 수 있는 값(차번호 가운데 한글, 품번 자릿수, 비슷한 거래처 이름)에는 <span class="listen-flag">들어 보기</span> 표시와 이유가 붙습니다.</li>
            <li>카드 칸을 누르면 그 말을 한 문장이 칠해지고, 녹음이 그 시각부터 나옵니다. 「두 개라고 했나?」를 바로 확인하세요.</li>
            <li>「되물을 것」이 남아 있으면 확정 단추가 막힙니다. 거래처에 다시 물어본 뒤 지우고 확정하세요.</li>
          </ul>
        </section>

        <section class="help-sec" aria-labelledby="h-home">
          <h2 id="h-home">휴대폰 홈 화면에 추가하기</h2>
          <div class="help-two">
            <div class="card help-step">
              <h3>안드로이드 · 크롬</h3>
              <ol>
                <li>크롬으로 이 사이트를 엽니다.</li>
                <li>오른쪽 위 <span class="kbd">⋮</span> (점 세 개)를 누릅니다.</li>
                <li>「홈 화면에 추가」 또는 「앱 설치」를 누릅니다.</li>
                <li>「추가」를 누르면 홈 화면에 콜노트 아이콘이 생깁니다.</li>
              </ol>
            </div>
            <div class="card help-step">
              <h3>아이폰 · 사파리</h3>
              <ol>
                <li>사파리로 이 사이트를 엽니다.</li>
                <li>아래쪽 공유 단추(네모에서 위로 향한 화살표)를 누릅니다.</li>
                <li>목록을 내려 「홈 화면에 추가」를 누릅니다.</li>
                <li>오른쪽 위 「추가」를 누릅니다.</li>
              </ol>
            </div>
          </div>
        </section>

        <section class="card help-big" aria-labelledby="h-big">
          <h2 id="h-big">글씨가 작으면</h2>
          <p>화면 맨 위 <strong>「글씨 크게」</strong> 단추를 누르면 모든 화면의 글씨가 커집니다. 한 번 켜 두면 다시 열어도 그대로입니다. 다시 누르면 보통 글씨로 돌아옵니다.</p>
          <button type="button" class="btn btn-primary btn-lg" data-act="big">${bigOn() ? '글씨 보통으로 돌리기' : '지금 글씨 크게 하기'}</button>
          <p class="help-note">그래도 작으면 휴대폰에서는 두 손가락으로 화면을 벌려 확대하고, PC 에서는 <span class="kbd">Ctrl</span> + <span class="kbd">+</span> 를 누르세요.</p>
        </section>

        <section class="card card-soft help-more" aria-labelledby="h-more">
          <h2 id="h-more">더 알아보기</h2>
          <div class="help-links">
            <a class="btn btn-primary" href="#/">오늘 브리핑부터 보기</a>
            <a class="btn" href="#/trial">무료 체험 신청</a>
            <a class="btn" href="/intro/">소개 페이지</a>
          </div>
        </section>`);
    }

    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act="big"]');
      if (!b || !root.contains(b)) return;
      // 위 막대의 「글씨 크게」 단추를 대신 눌러 같은 설정(저장 포함)을 쓴다
      const top = document.getElementById('bigTextBtn');
      if (top) top.click();
      else document.documentElement.classList.toggle('big-text');
      draw();
    }, { signal: ac.signal });

    draw();
    // F13 링크를 실제 거래처 하나로(못 불러와도 그냥 둔다)
    api.get('/api/customers', undefined, { signal: ac.signal })
      .then((r) => {
        const list = Array.isArray(r?.customers) ? r.customers : [];
        const first = list.find((c) => c && c.name && c.calls > 0) || list.find((c) => c && c.name);
        if (first && alive()) { st.firstCustomer = first.name; draw(); }
      })
      .catch(() => {});
    return () => ac.abort();
  },
};
