// The existing controller owns state/persistence. React owns only each control island.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {ThemeProvider,TextField,TextArea,Button} from '@montage-ui/core';
import {IconPlus,IconTrash} from '@montage-ui/icon';
import {ensureMontageStyles} from './runtime.js';
await ensureMontageStyles();
const roots=new Map();
const camel={class:'className',for:'htmlFor',tabindex:'tabIndex',maxlength:'maxLength',minlength:'minLength',autocomplete:'autoComplete',spellcheck:'spellCheck',inputmode:'inputMode',readonly:'readOnly',viewbox:'viewBox','stroke-width':'strokeWidth','stroke-linecap':'strokeLinecap','stroke-linejoin':'strokeLinejoin'};
const bools=new Set(['disabled','readOnly','required','multiple']);
function propsOf(node){const props={};for(const a of node.attributes){const k=camel[a.name]||a.name;if(k==='style'||k.startsWith('on'))continue;props[k]=bools.has(k)?true:a.value}return props}
function child(node,index){if(node.nodeType===3)return node.textContent;if(node.nodeType!==1)return null;return React.createElement(node.tagName.toLowerCase(),{...propsOf(node),key:index},...Array.from(node.childNodes).map(child))}
export function disposeControls(container){for(const [host,root] of roots){if(container===host||container.contains(host)){flushSync(()=>root.unmount());roots.delete(host)}}}
export function enhanceControls(container){
 for(const original of container.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]),textarea,button')){
  if(original.closest('[data-montage-host]'))continue;
  const tag=original.tagName.toLowerCase(),props=propsOf(original);
  props.className=(props.className||'').split(/\s+/).filter(c=>!['input','textarea','btn','btn-primary','btn-ghost','btn-sm'].includes(c)).join(' ');
  const host=document.createElement('span');host.dataset.montageHost=tag;host.className='montage-scope montage-control montage-'+tag;
  if(original.classList.contains('cd-qty-input'))host.classList.add('montage-qty');
  let component;
  if(tag==='button'){
   const primary=original.classList.contains('btn-primary');props.variant=primary?'solid':'outlined';props.color=primary?'primary':'assistive';props.size='medium';
   const action=original.dataset.act;
   const glyph=action==='item-add'?<IconPlus/>:original.hasAttribute('data-del')?<IconTrash/>:null;
   if(glyph)props.leadingContent=glyph;
   component=<Button {...props}>{Array.from(original.childNodes).map(child)}</Button>;
  }else{delete props.value;delete props.rows;props.defaultValue=original.value;props.width='100%';props.size='medium';component=tag==='textarea'?<TextArea {...props} minRows={2}/>:<TextField {...props}/>}
  original.replaceWith(host);const root=createRoot(host);roots.set(host,root);flushSync(()=>root.render(<ThemeProvider disableDefaultGlobalStyle>{component}</ThemeProvider>));
 }
}
