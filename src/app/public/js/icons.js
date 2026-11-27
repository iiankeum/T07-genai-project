// 직접 그린 일관된 선 아이콘. 사용자 값은 SVG 본문으로 넣지 않는다.
import { html, raw } from './ui.js';
const paths = {
  today: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M7 2v4m10-4v4M3 10h18m-13 5h3m3 0h2"/>',
  calls: '<path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a14 14 0 0 1-7-7l2-2-2-5Z"/>',
  board: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18m6-18v18M5.5 8h1m5-2h1m5 5h1"/>',
  shipping: '<path d="M3 7h11v11H3zM14 11h4l3 4v3h-7M3 7l3-3h8v3"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
  assistant: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
  ask: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  glossary: '<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15"/>',
  settings: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3v.2"/>',
  admin: '<path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  live: '<path d="M12 5v14M5 12h14"/>',
  account: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  more: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};
export function icon(name) {
  const key = Array.isArray(name) ? name[0] : name;
  return html`<svg class="ui-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${raw(paths[key] || paths.help)}</svg>`;
}
