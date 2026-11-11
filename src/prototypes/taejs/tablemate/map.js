/* 지도는 사용자가 열 때만 로드한다. 예시 식당 좌표와 직접 입력한 좌표를 구분한다. */
(() => {
  const el = id => document.getElementById(id);
  const centers = {강남:[37.4981,127.0276],성수:[37.5445,127.0557],판교:[37.3948,127.1112]};
  const demoPoints = {1:[37.4977,127.0290],2:[37.5007,127.0354],3:[37.5000,127.0255],4:[37.4984,127.0340],5:[37.5435,127.0569],6:[37.3936,127.1120],7:[37.4963,127.0283]};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let map, group, tileLayer, visible=false, selectedId=null, loading=null, lastArea=null;
  const markers = new Map();
  let places=[];
  try { const saved=JSON.parse(localStorage.getItem('tablemate-user-places-v1')||'[]'); if(Array.isArray(saved)) places=saved.filter(p=>p&&typeof p.id==='string'&&/^u-[a-zA-Z0-9-]+$/.test(p.id)&&typeof p.name==='string'&&typeof p.address==='string'&&Object.hasOwn(centers,p.area)&&Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&Number.isFinite(p.lng)&&Math.abs(p.lng)<=180).slice(0,100); } catch {}
  const allPoints = () => [...filtered().map(r=>({...r,lat:demoPoints[r.id][0],lng:demoPoints[r.id][1],demo:true})),...places.filter(p=>p.area===filters.area)];
  const queryLink = query => 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query);
  const directions = p => 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(`${p.lat},${p.lng}`)+'&travelmode=transit';
  const status = text => {el('mapStatus').textContent=text;el('mapStatus').hidden=!text;};
  function savePlaces(){try {localStorage.setItem('tablemate-user-places-v1',JSON.stringify(places));return true;}catch{toast('브라우저 저장 공간을 사용할 수 없어 저장하지 못했어요.');return false;}}
  function loadLeaflet(){
    if(window.L)return Promise.resolve();
    if(loading)return loading;
    loading=new Promise((resolve,reject)=>{
      const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.append(css);
      const script=document.createElement('script');script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';script.crossOrigin='anonymous';script.referrerPolicy='strict-origin-when-cross-origin';
      const timer=setTimeout(()=>reject(new Error('timeout')),15000);
      script.onload=()=>{clearTimeout(timer);window.L?resolve():reject(new Error('unavailable'));};script.onerror=()=>{clearTimeout(timer);reject(new Error('network'));};document.head.append(script);
    }).catch(e=>{loading=null;throw e;});return loading;
  }
  async function ensureMap(){
    if(map)return;
    status('지도 불러오는 중…');
    if(location.protocol==='file:'){status('지도는 localhost 또는 배포된 사이트에서 열어 주세요. 아래 외부 지도 링크는 바로 사용할 수 있어요.');return;}
    try {
      await loadLeaflet();if(map)return;
      map=L.map('placeMap',{scrollWheelZoom:false,zoomAnimation:!reduced,fadeAnimation:!reduced}).setView(centers[filters.area],15);
      tileLayer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',referrerPolicy:'strict-origin-when-cross-origin'}).addTo(map);
      let tileFailed=false;
      tileLayer.on('loading',()=>{tileFailed=false;status('지도 타일 불러오는 중…');});
      tileLayer.on('load',()=>{if(!tileFailed)status('');});
      tileLayer.on('tileerror',()=>{tileFailed=true;status('일부 지도 타일을 불러오지 못했어요. 외부 지도에서 위치를 확인해 주세요.');});
      group=L.featureGroup().addTo(map);
      L.control.scale({imperial:false}).addTo(map);
      map.on('click',()=>{document.querySelectorAll('[data-place-id]').forEach(card=>card.classList.remove('map-highlight'));});
      sync(true);
    }catch {status('지도를 불러오지 못했어요. “지도와 함께”를 다시 누르거나 외부 지도를 이용해 주세요.');}
  }
  function fit(){if(!map)return;map.invalidateSize();if(group.getLayers().length)map.fitBounds(group.getBounds().pad(.25),{maxZoom:16,animate:!reduced});else map.setView(centers[filters.area],15,{animate:!reduced});}
  async function setMode(show){visible=show;el('mapPanel').hidden=!show;el('mapLayout').classList.toggle('with-map',show);el('listMode').classList.toggle('active',!show);el('mapMode').classList.toggle('active',show);el('listMode').setAttribute('aria-pressed',String(!show));el('mapMode').setAttribute('aria-pressed',String(show));if(show){await ensureMap();if(map){map.invalidateSize();sync(true);}}}
  function select(p,pan=true){
    selectedId=p.id;document.querySelectorAll('[data-place-id]').forEach(c=>c.classList.toggle('map-highlight',c.dataset.placeId===String(p.id)));
    const target=el('mapSelection');target.replaceChildren();
    const label=document.createElement('small');label.textContent=p.demo?'가상 후보 · 실제 매장 위치 아님':'직접 추가한 장소 · 사용자 입력';
    const title=document.createElement('strong');title.textContent=p.name;
    const detail=document.createElement('p');detail.textContent=p.demo?`${p.category} · 1인 ${money(p.price)} · ${p.station} 주변 예시 위치`:p.address;
    const actions=document.createElement('div');actions.className='map-selection-actions';
    if(p.demo){const btn=document.createElement('button');btn.className='secondary';btn.textContent='후보 상세';btn.onclick=()=>openDetail(p.id);actions.append(btn);}
    const a=document.createElement('a');a.target='_blank';a.rel='noopener noreferrer';a.textContent=p.demo?'이 지역 실제 식당 검색 ↗':'외부 지도에서 장소 확인 ↗';a.href=queryLink(p.demo?`${p.area} ${p.category} 식당`:`${p.name} ${p.address}`);actions.append(a);
    if(!p.demo){const route=document.createElement('a');route.href=directions(p);route.target='_blank';route.rel='noopener noreferrer';route.textContent='입력한 위치로 길찾기 ↗';actions.append(route);}
    target.append(label,title,detail,actions);
    markers.forEach((m,key)=>m.getElement()?.classList.toggle('is-selected',key===p.id));
    if(map&&pan)map.panTo([p.lat,p.lng],{animate:!reduced});
  }
  function sync(fitAll=false){
    renderPersonal();el('mapAreaLabel').textContent=`${filters.area} 주변 · ${allPoints().length}개 위치`;el('areaMapLink').href=queryLink(`${filters.area} 단체 식사 식당`);
    if(!visible||!map)return;
    group.clearLayers();markers.clear();const points=allPoints();
    points.forEach((p,i)=>{
      const marker=L.marker([p.lat,p.lng],{title:`${p.name}${p.demo?' · 가상 위치':' · 사용자 입력 위치'}`,keyboard:true,icon:L.divIcon({className:`tablemate-marker ${p.demo?'demo-marker':'user-marker'}`,html:`<span>${p.demo?i+1:'★'}</span>`,iconSize:[34,38],iconAnchor:[17,38]})}).addTo(group);
      const tooltip=document.createElement('span');tooltip.textContent=`${p.name}${p.demo?' (가상 후보)':''}`;marker.bindTooltip(tooltip,{direction:'top',offset:[0,-25]});marker.on('click',()=>{select(p);document.querySelector(`[data-place-id="${p.id}"]`)?.scrollIntoView({block:'nearest',behavior:reduced?'auto':'smooth'});});markers.set(p.id,marker);
    });
    const chosen=points.find(p=>p.id===selectedId);if(chosen)select(chosen,false);else{selectedId=null;el('mapSelection').innerHTML='<p class="map-prompt">마커를 선택하면 후보와 위치를 함께 볼 수 있어요.</p>';}
    if(lastArea!==filters.area||fitAll){lastArea=filters.area;fit();}
  }
  async function focus(id){if(view!=='discover')setView('discover');await setMode(true);const p=allPoints().find(p=>p.id===id);if(p)select(p);el('mapPanel').scrollIntoView({block:'nearest',behavior:reduced?'auto':'smooth'});}
  function renderPersonal(){
    const list=places.filter(p=>p.area===filters.area);el('personalPlaceCount').textContent=list.length;
    el('personalPlaceList').innerHTML=list.length?list.map(p=>`<article class="personal-place" data-place-id="${safe(p.id)}"><div class="personal-place-pin">${icon('pin')}</div><div><strong>${safe(p.name)}</strong><p>${safe(p.address)}</p><small>사용자 입력 · ${safe(p.area)} · 조건 및 예약 가능 여부 미확인</small></div><div class="personal-place-actions"><button data-focus-place="${safe(p.id)}">지도</button><button data-edit-place="${safe(p.id)}">수정</button><button data-delete-place="${safe(p.id)}">삭제</button></div></article>`).join(''):'<div class="personal-empty">이미 알고 있는 식당이 있나요? 이름과 주소, 확인한 좌표를 넣어 후보 지도에 모아보세요.</div>';
    el('personalPlaceList').querySelectorAll('[data-focus-place]').forEach(b=>b.onclick=()=>focus(b.dataset.focusPlace));
    el('personalPlaceList').querySelectorAll('[data-edit-place]').forEach(b=>b.onclick=()=>editPlace(b.dataset.editPlace));
    el('personalPlaceList').querySelectorAll('[data-delete-place]').forEach(b=>b.onclick=()=>{const old=places;places=places.filter(p=>p.id!==b.dataset.deletePlace);if(!savePlaces())places=old;else toast('직접 추가한 장소를 삭제했어요.');sync();});
  }
  function editPlace(id){
    const p=places.find(p=>p.id===id)||{name:'',address:'',area:filters.area,lat:'',lng:''};
    showModal(`<div class="modal-body"><div class="modal-kicker">YOUR OWN SHORTLIST</div><h2>${id?'장소 정보 수정':'직접 찾은 장소 추가'}</h2><p>외부 지도에서 확인한 장소를 모임 후보로 보관하세요.<br>주소를 좌표로 자동 변환하지 않아요.</p><form id="placeForm" class="place-form"><label>식당 이름<input name="name" required maxlength="80" value="${safe(p.name)}" placeholder="직접 확인한 식당 이름"></label><label>주소<input name="address" required maxlength="200" value="${safe(p.address)}" placeholder="도로명 주소 또는 상세 위치"></label><label>모임 지역<select name="area">${Object.keys(centers).map(a=>`<option ${a===p.area?'selected':''}>${a}</option>`).join('')}</select></label><div class="coordinate-fields"><label>위도<input name="lat" type="number" step="any" min="-90" max="90" required value="${p.lat}" placeholder="37.4981"></label><label>경도<input name="lng" type="number" step="any" min="-180" max="180" required value="${p.lng}" placeholder="127.0276"></label></div><p class="source-note">Google 지도 등에서 위치를 선택해 좌표를 확인한 뒤 입력해 주세요. 좌표는 입력한 그대로 표시하며, 식당 주소·메뉴·룸·예약 여부는 자동 확인하지 않습니다. 이 브라우저에만 저장됩니다.</p><div class="place-form-actions"><a href="${safe(queryLink(p.name||`${p.area} 식당`))}" target="_blank" rel="noopener noreferrer">외부 지도 열기 ↗</a><button type="submit" class="primary">장소 저장</button></div></form></div>`);
    el('placeForm').onsubmit=e=>{e.preventDefault();const d=new FormData(e.currentTarget);const entry={id:id||'u-'+crypto.randomUUID(),name:String(d.get('name')).trim(),address:String(d.get('address')).trim(),area:String(d.get('area')),lat:Number(d.get('lat')),lng:Number(d.get('lng'))};if(!entry.name||!entry.address||!Number.isFinite(entry.lat)||Math.abs(entry.lat)>90||!Number.isFinite(entry.lng)||Math.abs(entry.lng)>180||!Object.hasOwn(centers,entry.area)){toast('이름, 주소와 올바른 좌표를 입력해 주세요.');return;}if(!id&&places.length>=100){toast('직접 추가한 장소는 최대 100곳까지 저장할 수 있어요.');return;}const old=places;places=id?places.map(x=>x.id===id?entry:x):[...places,entry];if(!savePlaces()){places=old;return;}closeModal();if(filters.area!==entry.area){el('location').value=entry.area;filters.area=entry.area;el('areaLabel').textContent=entry.area+' 주변';render();}sync();focus(entry.id);toast('직접 찾은 장소를 저장했어요.');};
  }
  el('listMode').onclick=()=>setMode(false);el('mapMode').onclick=()=>setMode(true);el('fitPlaces').onclick=fit;el('addPlace').onclick=()=>editPlace();
  window.TablemateMap={sync,focus};sync();
})();
