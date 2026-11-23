// 브라우저 연결 신호만 표시한다. 서버 정상 여부·저장 성공을 추정하거나 요청을 재전송하지 않는다.
export function mountConnectivity(win = window, doc = document) {
  const banner = doc.createElement('section');
  banner.className = 'connectivity-banner';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  banner.setAttribute('aria-atomic', 'true');
  banner.setAttribute('aria-label', '인터넷 연결 안내');
  const text = doc.createElement('span');
  const dismiss = doc.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'btn btn-sm';
  dismiss.textContent = '확인';
  dismiss.setAttribute('aria-label', '연결 안내 닫기');
  banner.append(text, dismiss);
  banner.hidden = true;
  doc.body.prepend(banner);
  let wasOffline = false;
  const measure = () => doc.body.style.setProperty('--connectivity-h', banner.hidden ? '0px' : `${banner.getBoundingClientRect().height}px`);
  const hide = () => {
    banner.hidden = true;
    doc.body.removeAttribute('data-connectivity-visible');
    measure();
  };
  const offline = () => {
    wasOffline = true;
    text.textContent = '인터넷 연결이 끊겼습니다. 작성 중인 화면은 그대로 둡니다. 저장·전송은 완료되지 않았을 수 있으니 연결 후 결과를 확인해 주세요.';
    dismiss.hidden = true;
    banner.hidden = false;
    doc.body.setAttribute('data-connectivity-visible', '');
    measure();
  };
  const online = () => {
    if (!wasOffline) return; // 최초 온라인 상태나 API 오류를 복구 성공으로 오인하지 않는다.
    wasOffline = false;
    text.textContent = '브라우저의 연결 신호가 돌아왔습니다. 서버 연결과 저장 결과는 아직 확인하지 않았습니다. 화면의 결과를 확인한 뒤 필요한 작업만 다시 시도해 주세요.';
    dismiss.hidden = false;
    banner.hidden = false;
    doc.body.setAttribute('data-connectivity-visible', '');
    measure();
  };
  dismiss.addEventListener('click', hide);
  win.addEventListener('offline', offline);
  win.addEventListener('online', online);
  win.addEventListener('resize', measure);
  const observer = win.ResizeObserver ? new win.ResizeObserver(measure) : null;
  observer?.observe(banner);
  if (win.navigator.onLine === false) offline();
  return () => {
    win.removeEventListener('offline', offline);
    win.removeEventListener('online', online);
    win.removeEventListener('resize', measure);
    dismiss.removeEventListener('click', hide);
    observer?.disconnect();
    hide();
    banner.remove();
    doc.body.style.removeProperty('--connectivity-h');
  };
}
