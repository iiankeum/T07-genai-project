// 읽기 전용 설정 점검. 파일·DB·네트워크·자식 프로세스에 접근하지 않으며 값은 출력하지 않는다.
import { pathToFileURL } from 'node:url';

export function releaseReadiness(env = {}) {
  const checks = [];
  const add = (id, status, message) => checks.push({ id, status, message });
  const value = (key, fallback = '') => typeof env[key] === 'string' && env[key].trim() ? env[key].trim() : fallback;
  const demo = value('DEMO_MODE', '1') !== '0';
  add('workspace-mode', demo ? 'blocked' : 'configured', demo
    ? '공개 가짜 데모 모드다. 실제 고객 자료용 비공개 작업공간이 아니다.'
    : '비공개 모드 설정이다. 실제 계정·역할·기존 자료 연결 검증은 별도다.');

  let https = false;
  try {
    const url = new URL(value('PUBLIC_BASE_URL'));
    https = url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
      && url.pathname === '/' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch { /* 비어 있거나 잘못된 주소: 값을 출력하지 않는다. */ }
  add('team-address', https ? 'unverified' : 'blocked', https
    ? 'HTTPS 기본 주소 형식이다. 인증서·접속·프록시 신뢰 설정은 확인하지 않았다.'
    : '팀 공개 주소로 쓸 HTTPS 기본 주소가 없거나 형식이 부적절하다. 로컬 HTTP 체험과 구분한다.');

  const mail = env.AUTH_MAIL_MODE ?? ''; // auth.mjs도 이 값은 trim하지 않는다.
  add('account-mail', 'blocked', mail === 'outbox'
    ? '가입·초대·복구 링크는 서버 outbox 파일에만 저장된다. 외부 이메일 발송은 미구현이다.'
    : '현재 코드의 인증 링크 전달은 outbox만 지원한다. 설정 이름만 바꿔도 실제 이메일이 발송되지 않는다.');

  const provider = value('AI_PROVIDER', 'off').toLowerCase();
  if (provider === 'fixture') add('order-ai', 'blocked', 'fixture는 가짜 응답이다. 실제 녹음의 주문 추출을 검증한 것이 아니다.');
  else if (provider === 'off') add('order-ai', 'blocked', '주문 자동 정리가 꺼져 있다. 수동 업무 사용 가능 여부와 자동 처리 준비를 구분한다.');
  else if (provider === 'ollama') add('order-ai', 'unverified', '로컬 모델 연결 설정이다. 모델 설치·실행·가짜 녹음 품질을 실제로 검증해야 한다.');
  else if (provider === 'anthropic') add('order-ai', 'unverified', '유료 제공자 설정이다. 키·비용 동의·작업공간 허용·품질을 확인하지 않았고 호출하지 않았다.');
  else add('order-ai', 'blocked', '지원하지 않는 AI 제공자 설정이다. 값은 출력하지 않는다.');
  add('paid-guard', env.ALLOW_PAID_AI === '1' ? 'unverified' : 'configured', env.ALLOW_PAID_AI === '1'
    ? '전역 유료 호출 허용 설정이다. 작업공간 동의와 한도 확인 전 실제 호출을 하지 않는다.'
    : '전역 유료 호출은 차단 설정이다. 이 점검 자체는 제공자를 호출하지 않는다.');
  add('transcription', 'unverified', '받아쓰기 일꾼·모델·실행기·작업공간 연결과 실제 가짜 녹음 처리를 확인하지 않았다. 토큰 존재만으로 완료 판정하지 않는다.');
  add('backup-restore', 'unverified', '실제 자료의 최신 백업·별도 복원·담당자 권한·일일 백업 운영 확인이 필요하다. 코드 롤백은 DB 복원이 아니다.');
  add('privacy-security', 'unverified', '저장 암호화·고지/동의·보관 파기·접근 기록·법률 검토와 운영 설정은 확인하지 않았다.');
  add('client-release', 'unverified', '브라우저 호환·성능·현장 음성 품질, Mac 서명/공증·신규 기기 설치는 별도 검증 대상이다.');
  return {
    schemaVersion: 1,
    scope: 'configuration-only; no file/database/network/model access; no secret values',
    releaseReady: false,
    automaticProcessingVerified: false,
    checks,
    counts: Object.fromEntries(['blocked', 'unverified', 'configured'].map(s => [s, checks.filter(c => c.status === s).length])),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length > 2) {
    console.error('사용법: node [--env-file=경로] tools/release-readiness.mjs (환경값·파일 내용은 출력하지 않음)');
    process.exitCode = 64;
  } else {
    console.log(JSON.stringify(releaseReadiness(process.env), null, 2));
    // 0은 출시 승인으로 오인할 수 있으므로 미검증/미구현이 있는 현재 버전은 2다.
    process.exitCode = 2;
  }
}
