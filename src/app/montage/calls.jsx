import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Button, SearchField, ThemeProvider } from '@montage-ui/core';
import { ensureMontageStyles } from './runtime.js';

export const prepareMontageCalls = ensureMontageStyles;

export function mountMontageCallsSearch(host, { query }) {
  if (!host.isConnected) return null;
  const root = createRoot(host);
  let field;
  let clear;
  try {
    flushSync(() => root.render(
      <ThemeProvider disableDefaultGlobalStyle>
        <SearchField ref={node => { field = node; }} id="cl-q"
          aria-label="통화 찾기" enterKeyHint="search" autoComplete="off"
          placeholder="거래처, 차종, 부품 또는 차번호 검색" defaultValue={query}
          maxLength={100} variant="outlined" size="large" width="100%" />
        <Button ref={node => { clear = node; }} type="button"
          variant="outlined" color="assistive" size="large"
          data-act="clear-q" className={query ? '' : 'hidden'}
          aria-label="검색어 지우기">지우기</Button>
      </ThemeProvider>
    ));
    if (!field || !clear) throw new Error('Montage search controls did not mount');
    return { field, destroy: () => root.unmount() };
  } catch (error) {
    root.unmount();
    throw error;
  }
}

export function mountMontageCallsStatuses(host) {
  host.classList.add('montage-scope');
  const root = createRoot(host);
  return {
    update(items, selected) {
      flushSync(() => root.render(
        <ThemeProvider disableDefaultGlobalStyle>
          <p className="cl-group-label" id="cl-status-l">상태</p>
          <div className="tabs cl-tabs cl-montage-statuses" role="group" aria-labelledby="cl-status-l">
            {items.map(([id, label]) => <Button type="button" key={id} data-status={id}
              aria-pressed={selected === id} color={selected === id ? "primary" : "assistive"}
              size="medium" variant={selected === id ? "solid" : "outlined"}>{label}</Button>)}
          </div>
        </ThemeProvider>
      ));
    },
    destroy: () => root.unmount(),
  };
}
