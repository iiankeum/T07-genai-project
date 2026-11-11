// 무료 체험 신청(최소 항목 + 개인정보 수집 · 이용 동의). 신청 내용은 관리자만 본다(routes/admin.mjs).
// 응답 · 로그에 신청 내용(개인정보)을 남기지 않는다.
import { db, newId, nowIso } from '../lib/db.mjs';
import { HttpError, readJson, cleanText } from '../lib/http.mjs';
import { limit, ipHash } from '../lib/security.mjs';

export const RETENTION_UNTIL = '2026-12-31';
const MAX_TRIALS = 5000;

/** 동의 문구(화면 · 소개 페이지가 그대로 보여 준다) */
export const TRIAL_POLICY = Object.freeze({
  title: '개인정보 수집 · 이용 동의',
  controller: '콜노트(가칭) 데모 — T07 팀 수업 프로젝트',
  purpose: '무료 체험 안내 연락',
  items: '이름 · 소속 · 연락처(전화 또는 이메일) · 역할 · 남긴 말 (이름과 연락처는 꼭 적고, 나머지는 적고 싶을 때만)',
  retention: `수업 프로젝트가 끝나면(${RETENTION_UNTIL}) 지체 없이 파기합니다.`,
  notice: '동의하지 않을 권리가 있습니다. 동의하지 않으면 무료 체험 안내를 받을 수 없습니다.',
  note: '같은 곳에서 너무 많이 보내는 것을 막으려고, 접속 주소(IP)를 알아볼 수 없게 바꾼 값만 함께 저장합니다.',
});

function field(v, { max, min = 0, required = false, missing, tooLong }) {
  if (v != null && typeof v !== 'string' && typeof v !== 'number') throw new HttpError(400, 'bad_input', '글자로 적어 주세요.');
  const s = cleanText(v, 100_000);
  if (!s) {
    if (required) throw new HttpError(400, 'required', missing);
    return null;
  }
  const len = [...s].length;
  if (len > max) throw new HttpError(400, 'too_long', tooLong);
  if (len < min) throw new HttpError(400, 'too_short', missing);
  return s;
}

/** 연락처: 이메일이거나, 숫자 8~15자리인 전화번호 */
export function isContact(s) {
  if (/^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(s)) return true;
  if (/^[0-9+\-\s().]+$/.test(s)) {
    const digits = s.replace(/[^0-9]/g, '');
    return digits.length >= 8 && digits.length <= 15;
  }
  return false;
}

export function register(router) {
  router.get('/api/trial/policy', () => ({ ...TRIAL_POLICY }));

  // 앱의 #/trial 과 소개 페이지(/intro/, 강현 방)의 신청을 같은 처리로 받는다.
  // 소개 페이지 본문: {name, phone, email, consentPrivacy, consentMarketing, industry, callsPerDay, region,
  //   recordingSetup, heardFrom, interviewOk, source, pageVersion, website(스팸 숨은 칸)} + 설계 기본 칸(org, contact, role, message, consent)
  const handler = async ({ req, ip }) => {
    const body = await readJson(req, 16 * 1024);
    // 스팸 숨은 칸이 채워져 오면 저장하지 않고 성공처럼 돌려준다
    if (typeof body.website === 'string' && body.website.trim() !== '') return { ok: true };
    if (body.consent !== true && body.consentPrivacy !== true) throw new HttpError(400, 'consent_required', '개인정보 수집 · 이용에 동의해 주세요.');
    const name = field(body.name, { max: 40, min: 1, required: true, missing: '이름을 적어 주세요.', tooLong: '이름은 40자까지 쓸 수 있어요.' });
    const org = field(body.org, { max: 60, tooLong: '소속은 60자까지 쓸 수 있어요.' });
    const phone = field(body.phone, { max: 40, tooLong: '전화번호가 너무 깁니다.' });
    const email = field(body.email, { max: 80, tooLong: '이메일이 너무 깁니다.' });
    const contact = field(body.contact || phone || email, { max: 80, min: 5, required: true, missing: '연락처(휴대폰 번호 또는 이메일)를 적어 주세요.', tooLong: '연락처는 80자까지 쓸 수 있어요.' });
    if (!isContact(contact)) throw new HttpError(400, 'bad_contact', '휴대폰 번호나 이메일을 다시 확인해 주세요.');
    const role = field(body.role, { max: 30, tooLong: '역할은 30자까지 쓸 수 있어요.' });
    const message = field(body.message, { max: 500, tooLong: '남길 말은 500자까지 쓸 수 있어요.' });
    const code = (v, max = 40) => {
      const t = cleanText(v, max);
      return t && /^[\p{L}\p{N} ._\-·+]+$/u.test(t) ? t : null;
    };
    const now = nowIso();
    const extra = {
      phone: phone || null,
      email: email || null,
      industry: code(body.industry),
      callsPerDay: code(body.callsPerDay),
      region: code(body.region),
      recordingSetup: code(body.recordingSetup),
      heardFrom: code(body.heardFrom),
      interviewOk: body.interviewOk === true,
      consentMarketing: body.consentMarketing === true,
      consentMarketingAt: body.consentMarketing === true ? now : null,
      source: code(body.source) || (body.pageVersion ? 'direct' : 'app'),
      pageVersion: code(body.pageVersion, 60),
      form: body.pageVersion ? 'intro' : 'app',
    };

    // 형식이 맞는 신청만 횟수에 센다(잘못 적어 다시 보내는 사람이 막히지 않게)
    limit('trial', ip);
    if (db().prepare('SELECT COUNT(*) AS n FROM trials').get().n >= MAX_TRIALS) {
      throw new HttpError(503, 'trial_full', '지금은 신청을 받을 수 없습니다. 잠시 뒤 다시 해 주세요.');
    }
    db().prepare('INSERT INTO trials(id, created_at, name, org, contact, role, message, consent_at, ip_hash, extra) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(newId('trial'), now, name, org, contact, role, message, now, ipHash(ip), JSON.stringify(extra));
    console.log('[trial] 새 신청 1건');
    return { ok: true };
  };
  router.post('/api/trial', handler);
  router.post('/api/trial-signup', handler);
}
