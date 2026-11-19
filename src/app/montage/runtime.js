let styles;
// Same-origin assets only. A failed load must not strand the native page.
export function ensureMontageStyles(){
 if(styles)return styles;
 styles=new Promise((resolve,reject)=>{
  const link=document.createElement('link');
  link.rel='stylesheet';link.href='/montage/tokens.css';
  const timer=setTimeout(fail,5000);
  function fail(){clearTimeout(timer);link.onload=link.onerror=null;link.remove();styles=null;reject(new Error('Montage 스타일을 불러오지 못했습니다.'))}
  link.onload=()=>{clearTimeout(timer);link.onload=link.onerror=null;resolve()};
  link.onerror=fail;document.head.append(link);
 });
 return styles;
}
