import React from 'react';
import { createPortal, flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { BottomNavigation, BottomNavigationItem, Button, ThemeProvider } from '@montage-ui/core';
import {
  IconApps, IconBook, IconChevronDown, IconHome, IconMenu, IconPhone,
  IconQuestion, IconSearch, IconSetting, IconSparkle, IconUpload,
} from '@montage-ui/icon';
import { ensureMontageStyles } from './runtime.js';

const icons = {
  today: IconHome, calls: IconPhone, board: IconApps, shipping: IconUpload,
  ask: IconSearch, assistant: IconSparkle, glossary: IconBook, more: IconMenu,
  settings: IconSetting, help: IconQuestion,
};

function NavIcon({ page }) {
  const Icon = icons[Array.isArray(page) ? page[0] : page] || IconMenu;
  return <Icon aria-hidden="true" focusable="false" />;
}

function Workspace({ model }) {
  return (
    <a className="workspace-switch" href={model.workspace.href} title="워크스페이스 선택">
      <span className="workspace-copy">
        <strong>{model.workspace.name}</strong>
        <span>{model.workspace.demo ? '예시 데이터로 체험 중' : '내 작업공간'}</span>
      </span>
      <IconChevronDown className="workspace-chevron" aria-hidden="true" />
    </a>
  );
}

function Sidebar({ model }) {
  return <>
    <div className="lnb-workspace"><Workspace model={model} /></div>
    {model.groups.map((group, i) => (
      <div className={i === model.groups.length - 1 ? 'nav-group lnb-bottom' : 'nav-group'} key={group.label}>
        {group.label && <p className="nav-group-label">{group.label}</p>}
        <ul>{group.items.map((item) => (
          <li key={item.href}><a className="nav-link" href={item.href} aria-current={item.active ? 'page' : undefined}>
            <NavIcon page={item.page} /><span className="nav-label">{item.label}</span>
          </a></li>
        ))}</ul>
      </div>
    ))}
  </>;
}

function Mobile({ model }) {
  return <BottomNavigation value={model.tabs.find((tab) => tab.active)?.href || ''}>
    {model.tabs.map((tab) => (
      <BottomNavigationItem as="a" href={tab.href} value={tab.href} key={tab.href}
        icon={<NavIcon page={tab.page} />} label={tab.label} />
    ))}
  </BottomNavigation>;
}

export async function mountMontageShell(slots) {
  await ensureMontageStyles();
  const targets = Object.values(slots);
  if (targets.some((node) => !node?.isConnected)) throw new Error('아차 메뉴 컨테이너가 없습니다.');
  const root = createRoot(document.createElement('div'));
  for (const node of targets) {
    node.replaceChildren();
    node.classList.add('montage-scope', 'ahcha-montage-shell');
  }
  return {
    update(model) {
      flushSync(() => root.render(
        <ThemeProvider disableDefaultGlobalStyle>
          {createPortal(<Workspace model={model} />, slots.workspace)}
          {createPortal(<Sidebar model={model} />, slots.sidebar)}
          {createPortal(<Mobile model={model} />, slots.mobile)}
          {createPortal(<>
            <Button as="a" href="#/upload" size="small" variant="outlined" color="assistive" className="header-upload">녹음 올리기</Button>
            <Button as="a" href="#/live" size="small" className="header-live">받아쓰기</Button>
          </>, slots.actions)}
        </ThemeProvider>,
      ));
    },
    destroy() {
      root.unmount();
      for (const node of targets) node.classList.remove('montage-scope', 'ahcha-montage-shell');
    },
  };
}
