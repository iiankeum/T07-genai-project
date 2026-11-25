// One mounted workspace chat across business routes. A call retains its separate scoped evidence chat.
import assistant from './pages/assistant.js';

const PAGES = new Set(['today', 'calls', 'board', 'shipping', 'customer', 'live', 'upload', 'glossary', 'settings', 'more']);
const DESKTOP = '(min-width: 1120px)';

export function createWorkspaceAsk() {
  const desktop = matchMedia(DESKTOP);
  let state = null;
  let visible = false;
  function attach() {
    if (!state || !visible) return;
    const { rail, launch, dialog, close } = state;
    if (desktop.matches) {
      document.body.append(rail);
      if (dialog.open) dialog.close();
      dialog.remove();
      launch.remove();
    } else {
      dialog.append(rail);
      document.body.append(launch, dialog);
      close.hidden = false;
    }
  }
  function hide() {
    visible = false;
    document.body.classList.remove('has-workspace-ask');
    if (!state) return;
    if (state.dialog.open) state.dialog.close();
    state.rail.remove();
    state.launch.remove();
    state.dialog.remove();
  }
  function reset() {
    hide();
    state?.cleanup();
    state = null;
  }
  function sync(page, meta) {
    const access = meta?.access;
    if (!access) { reset(); return false; }
    const key = JSON.stringify([access.workspace?.id, access.user?.id, access.role, access.demo]);
    if (state && state.key !== key) reset();
    if (!PAGES.has(page)) { hide(); return false; }
    if (!state) {
      const rail = document.createElement('aside');
      rail.className = 'workspace-ask-rail';
      rail.id = 'workspaceAskRail';
      rail.setAttribute('aria-label', 'Ask 아차');
      const launch = document.createElement('button');
      launch.type = 'button';
      launch.className = 'btn workspace-ask-launch';
      launch.textContent = 'Ask 아차';
      launch.setAttribute('aria-haspopup', 'dialog');
      launch.setAttribute('aria-controls', 'workspaceAskDialog');
      const dialog = document.createElement('dialog');
      dialog.id = 'workspaceAskDialog';
      dialog.className = 'workspace-ask-dialog';
      dialog.setAttribute('aria-label', 'Ask 아차');
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'btn btn-ghost workspace-ask-close';
      close.textContent = '닫기';
      dialog.append(close);
      launch.addEventListener('click', () => { if (!dialog.open && launch.isConnected) dialog.showModal(); });
      close.addEventListener('click', () => dialog.close());
      dialog.addEventListener('close', () => { if (visible && !desktop.matches && launch.isConnected) launch.focus({ preventScroll: true }); });
      state = { key, rail, launch, dialog, close, cleanup: assistant.mount(rail, { embedded: true, workspaceRail: true, meta, query: {} }) };
    }
    visible = true;
    document.body.classList.add('has-workspace-ask');
    attach();
    return true;
  }
  desktop.addEventListener('change', attach);
  for (const event of ['ahmatda:workspace-changed', 'ahmatda:session-expired', 'ahmatda:explicit-logout']) window.addEventListener(event, reset);
  return { sync, hide, reset };
}
