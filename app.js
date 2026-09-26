const CONFIG={dataUrl:'/api/data',medalUrl:'/api/medals',fallbackDataUrl:'./data.json',officialSite:'https://results.asiangames2026.org/'};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let APP_DATA=null, MEDAL_DATA=null, CURRENT_DATE='';
const FAV_KEY='asiad20-favorites',REMINDER_KEY='asiad20-reminders',REMINDER_MINUTES=30;

function pick(o,keys,f){if(!o||typeof o!=='object')return f;for(const k of keys)if(Object.prototype.hasOwnProperty.call(o,k)&&o[k]!=null)return o[k];return f}
function asArray(v){return Array.isArray(v)?v:[]}
function asNumber(v){const n=Number(v);return Number.isFinite(n)?n:0}
function normalizeStatusValue(v){const s=String(v||'').trim().toLowerCase();if(['live','đang thi đấu','dang thi dau'].includes(s))return'live';if(['done','finished','official','hoàn thành','hoan thanh','đã kết thúc','da ket thuc'].includes(s))return'done';if(['upcoming','scheduled','sắp thi đấu','sap thi dau'].includes(s))return'upcoming';return s||'upcoming'}
function normalizeEvent(x={}){return{id:String(pick(x,['id','resCode','ResCode'],'')||''),date:String(pick(x,['date','ngày','Ngày'],'')||''),time:String(pick(x,['time','Thời gian','thời gian'],'')||''),status:normalizeStatusValue(pick(x,['status','Trạng thái','trạng thái'],'upcoming')),icon:String(pick(x,['icon','biểu tượng','Biểu tượng'],'🏅')||'🏅'),sport:String(pick(x,['sport','Môn thể thao','Thể thao','môn thể thao'],'ASIAD 20')||'ASIAD 20'),event:String(pick(x,['event','Sự kiện','sự kiện'],'')||''),athlete:String(pick(x,['athlete','Vận động viên','vận động viên'],'')||''),vn:String(pick(x,['vn'],'')||pick(x,['athlete','Vận động viên','vận động viên'],'')||''),opponent:String(pick(x,['opponent','Đối thủ','đối thủ'],'')||''),score:String(pick(x,['score','Điểm số','điểm','Điểm'],'')??''),detail:String(pick(x,['detail','Chi tiết','chi tiết'],'')||''),venue:String(pick(x,['venue','Địa điểm','địa điểm'],'')||''),result:String(pick(x,['result','Kết quả','kết quả'],'')||pick(x,['score','Điểm số','điểm'],'')||'')}}
function normalizeAthlete(a={}){return{name:String(pick(a,['name','tên','Tên'],'')||''),sport:String(pick(a,['sport','Thể thao','Môn thể thao'],'ASIAD 20')||'ASIAD 20'),gender:String(pick(a,['gender','giới tính','Giới tính'],'')||''),team:String(pick(a,['team','đội','Đội'],'Đội tuyển Việt Nam')||'Đội tuyển Việt Nam'),highlights:asArray(pick(a,['highlights','Điểm nổi bật','điểm nổi bật'],[])),avatar:pick(a,['avatar'],'👤'),birthYear:pick(a,['birthYear','năm sinh'],'')||'',height:pick(a,['height','chiều cao'],'')||'',hometown:pick(a,['hometown','quê quán'],'')||''}}
function normalizeMedalRow(m={}){const rawVN=pick(m,['isVietnam','là Việt Nam','isVietNam'],false);return{rank:String(pick(m,['rank','thứ hạng','Thứ hạng'],'—')||'—'),country:String(pick(m,['country','đất nước','Đoàn'],'Việt Nam')||'Việt Nam'),org:String(pick(m,['org','Org'],'')||''),gold:asNumber(pick(m,['gold','vàng','Vàng'],0)),silver:asNumber(pick(m,['silver','bạc','Bạc'],0)),bronze:asNumber(pick(m,['bronze','đồng','Đồng'],0)),total:asNumber(pick(m,['total','Tổng cộng','tổng cộng','Tổng'],0)),isVietnam:rawVN===true||String(rawVN).toLowerCase()==='true'||String(rawVN).toLowerCase()==='đúng'}}
function normalizeAppData(data={}){const meta=pick(data,['meta'],{})||{},v=pick(data,['vietnam','Việt Nam','vietNam'],{})||{};return{meta:{label:String(pick(meta,['label'],'Dữ liệu Bornan chính thức')||'Dữ liệu Bornan chính thức'),sourceMode:String(pick(meta,['sourceMode'],'official-live')||'official-live'),lastUpdated:String(pick(meta,['lastUpdated'],'')||''),date:String(pick(meta,['date','ngày','Ngày'],'')||'')},vietnam:{rank:String(pick(v,['rank','thứ hạng','Thứ hạng'],'—')||'—'),gold:asNumber(pick(v,['gold','vàng','Vàng'],0)),silver:asNumber(pick(v,['silver','bạc','Bạc'],0)),bronze:asNumber(pick(v,['bronze','đồng','Đồng'],0)),total:asNumber(pick(v,['total','Tổng cộng','tổng cộng','Tổng'],0))},sports:asArray(pick(data,['sports','thể thao','Thể thao'],[])).map(String),sportDetails:asArray(pick(data,['sportDetails','chi tiết môn'],[])),athletes:asArray(pick(data,['athletes','vận động viên','Vận động viên'],[])).map(normalizeAthlete).filter(a=>a.name),live:asArray(pick(data,['live','sống','trực tiếp','Trực tiếp'],[])).map(normalizeEvent),upcoming:asArray(pick(data,['upcoming','sắp tới','Sắp tới'],[])).map(normalizeEvent),latest:asArray(pick(data,['latest','mới nhất','Mới nhất'],[])).map(normalizeEvent),medals:asArray(pick(data,['medals','huy chương','Huy chương'],[])).map(normalizeMedalRow),dailyMedallists:asArray(pick(data,['dailyMedallists'],[])),counts:pick(data,['counts','số lượng','Số lượng'],{})||{}}}
function normalizeMedalData(data={}){return{official:Boolean(data.official),label:String(data.label||'Bảng huy chương'),updatedAt:String(data.updatedAt||''),source:String(data.source||''),method:String(data.method||''),rows:asArray(data.rows).map(normalizeMedalRow),vietnam:data.vietnam?normalizeMedalRow(data.vietnam):null}}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function fmtTime(iso){try{return new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'medium'}).format(new Date(iso))}catch{return iso}}
function eventDate(x){return new Date(`${x.date}T${x.time}:00+07:00`)}
function getFavs(){try{return JSON.parse(localStorage.getItem(FAV_KEY)||'[]')}catch{return[]}}
function setFavs(v){localStorage.setItem(FAV_KEY,JSON.stringify(v));renderFavorites();renderScheduleFiltered();renderReminderCenter()}
function isFav(id){return getFavs().includes(id)}
function toggleFav(id){const f=getFavs();setFavs(f.includes(id)?f.filter(x=>x!==id):[...f,id])}
function getReminderState(){try{return JSON.parse(localStorage.getItem(REMINDER_KEY)||'{}')}catch{return{}}}
function saveReminderState(v){localStorage.setItem(REMINDER_KEY,JSON.stringify(v))}

async function loadData(date=''){try{const u=CONFIG.dataUrl+(date?`?date=${encodeURIComponent(date)}`:'');const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw Error('Không kết nối được máy chủ dữ liệu');return normalizeAppData(await r.json())}catch(e){if(APP_DATA)throw e;const r=await fetch(CONFIG.fallbackDataUrl,{cache:'no-store'});if(!r.ok)throw Error('Không tải được dữ liệu');const d=await r.json();d.meta={...d.meta,sourceMode:'fallback-demo',label:'Dữ liệu mẫu — chưa kết nối máy chủ Bornan'};return normalizeAppData(d)}}
async function loadMedals(date=''){const u=CONFIG.medalUrl+(date?`?date=${encodeURIComponent(date)}`:'');const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw Error('Không tải được bảng huy chương');return normalizeMedalData(await r.json())}

function medalVietnamSummary(){if(MEDAL_DATA?.vietnam)return MEDAL_DATA.vietnam;return APP_DATA?.vietnam||{rank:'—',gold:0,silver:0,bronze:0,total:0}}
function renderHero(){const v=medalVietnamSummary();$('#heroMedals').innerHTML=`<div class="medal">🥇<b>${v.gold}</b><small>HCV</small></div><div class="medal">🥈<b>${v.silver}</b><small>HCB</small></div><div class="medal">🥉<b>${v.bronze}</b><small>HCĐ</small></div><div class="medal">🏆<b>${v.total}</b><small>Tổng</small></div>`;$('#vnRank').textContent=`Hạng ${v.rank}`;const tag=$('#medalModeTag');if(tag)tag.textContent=MEDAL_DATA?.official?'Tổng sắp chính thức':'Huy chương trong ngày'}
function sportButton(name){return`<button class="textlink" data-sport-detail="${esc(name)}">${esc(name)}</button>`}
function athleteButton(name){return name?`<button class="textlink athlete-link" data-athlete-detail="${esc(name)}">${esc(name)}</button>`:''}
function renderLive(items){$('#liveCount').textContent=`${items.length} nội dung`;$('#liveCards').innerHTML=items.length?items.map(x=>`<article class="card"><span class="live">LIVE</span><h4>${x.icon} ${sportButton(x.sport)}</h4><div class="meta">${esc(x.event)}</div><div>🇻🇳 ${athleteButton(x.vn)}${x.opponent?` • Đối thủ: ${esc(x.opponent)}`:''}</div><div class="score">${esc(x.score)}</div><div class="meta">${esc(x.detail)}<br>⏰ ${esc(x.time)} • 📍 ${esc(x.venue)}</div></article>`).join(''):'<div class="empty-card">Hiện không có nội dung đang thi đấu.</div>';bindDetailButtons()}
function renderRows(id,items,type){const empty=type==='upcoming'?'Không có nội dung sắp thi đấu trong ngày đang xem.':'Chưa có kết quả.';$(id).innerHTML=items.length?items.slice(0,type==='result'?12:8).map(x=>`<div class="row"><div class="time">${esc(x.time)}</div><div><b>${x.icon} ${sportButton(x.sport)}</b><div class="meta">${esc(x.event)}</div>${athleteButton(x.athlete||x.vn)}</div><div class="${type==='result'?'result':''}">${type==='result'?esc(x.result||'—'):'🔔'}</div></div>`).join(''):`<div class="empty-card">${empty}</div>`;bindDetailButtons()}
function medalRowsHtml(items){return items.map(x=>`<tr class="${x.isVietnam?'vn':''}"><td>${esc(x.rank)}</td><td>${x.isVietnam?'🇻🇳 ':''}${esc(x.country)}</td><td>${x.gold}</td><td>${x.silver}</td><td>${x.bronze}</td><td><b>${x.total}</b></td></tr>`).join('')}
function renderMedals(){const rows=MEDAL_DATA?.rows?.length?MEDAL_DATA.rows:(APP_DATA?.medals||[]);const html=medalRowsHtml(rows);$('#medalBody').innerHTML=html;const vn=rows.filter(x=>x.isVietnam);$('#homeMedalBody').innerHTML=medalRowsHtml(vn.length?vn:rows.slice(0,1));const info=$('#medalSourceInfo');if(info)info.innerHTML=`<b>${esc(MEDAL_DATA?.label||'Huy chương Việt Nam trong ngày')}</b>${MEDAL_DATA?.official?' • nguồn Bornan chính thức':' • chế độ dự phòng'}${MEDAL_DATA?.updatedAt?` • cập nhật ${esc(fmtTime(MEDAL_DATA.updatedAt))}`:''}`}
function allScheduleItems(){return[...(APP_DATA?.live||[]),...(APP_DATA?.upcoming||[]),...(APP_DATA?.latest||[])]}
function statusLabel(s){return s==='live'?'🔴 Đang thi đấu':s==='done'?'✅ Đã kết thúc':'⏰ Sắp thi đấu'}
function renderScheduleFiltered(){if(!APP_DATA)return;const sport=$('#sportFilter')?.value||'',status=$('#statusFilter')?.value||'';const items=allScheduleItems().filter(x=>(!sport||x.sport===sport)&&(!status||x.status===status)).sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));$('#scheduleList').innerHTML=items.length?items.map(x=>`<div class="row"><div class="time">${esc(x.time)}</div><div><b>${x.icon} ${sportButton(x.sport)}</b><div class="meta">${esc(x.event)}</div><div class="ath">${athleteButton(x.athlete||x.vn)}</div><div class="meta">${statusLabel(x.status)}${x.opponent?` • ${esc(x.opponent)}`:''}</div></div><button class="favbtn ${isFav(x.id)?'active':''}" data-fav="${esc(x.id)}">${isFav(x.id)?'★':'☆'}</button></div>`).join(''):'<div class="empty-card">Không có nội dung phù hợp bộ lọc.</div>';$$('[data-fav]').forEach(b=>b.onclick=()=>toggleFav(b.dataset.fav));bindDetailButtons()}
function renderLiveScreen(){const live=APP_DATA?.live||[],latest=APP_DATA?.latest||[];$('#liveScreenCards').innerHTML=live.length?live.map(x=>`<div class="card"><span class="live">LIVE</span><h4>${x.icon} ${sportButton(x.sport)}</h4><div class="meta">${esc(x.event)}</div><div class="score">${esc(x.score)}</div><div class="meta">🇻🇳 ${athleteButton(x.vn)}${x.opponent?` • ${esc(x.opponent)}`:''}<br>${esc(x.detail)}</div></div>`).join(''):`<div class="empty-card">Hiện không có nội dung trực tiếp. Bên dưới là kết quả gần nhất.</div>`;$('#liveRecent').innerHTML=latest.slice(0,10).map(x=>`<div class="row"><div class="time">${esc(x.time)}</div><div><b>${x.icon} ${esc(x.sport)}</b><div class="meta">${esc(x.event)}</div>${athleteButton(x.athlete||x.vn)}</div><div class="result">${esc(x.result||'—')}</div></div>`).join('');bindDetailButtons()}
function populateFilters(){const s=$('#sportFilter');if(s)s.innerHTML='<option value="">Tất cả môn</option>'+asArray(APP_DATA?.sports).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}
function setStatus(){const m=APP_DATA?.meta||{};$('#sourceLabel').textContent=m.label||'Dữ liệu Bornan chính thức';$('#lastUpdated').textContent=m.lastUpdated?`Cập nhật: ${fmtTime(m.lastUpdated)}`:'';$('#statusDot').classList.toggle('demo',!String(m.sourceMode||'').includes('official'));if($('#currentDateLabel'))$('#currentDateLabel').textContent=m.date?m.date.split('-').reverse().join('/'):'—';if($('#dateFilter')&&m.date)$('#dateFilter').value=m.date}

function renderVietnamTab(){if(!APP_DATA)return;const items=allScheduleItems(),sports=[...new Set(items.map(x=>x.sport))],meds=APP_DATA.dailyMedallists||[];$('#vnStats').innerHTML=`<div class="stat"><b>${APP_DATA.counts?.total??items.length}</b><span>Nội dung trong ngày</span></div><div class="stat"><b>${sports.length}</b><span>Môn có Việt Nam</span></div><div class="stat"><b>${APP_DATA.athletes.length}</b><span>VĐV/đội nhận diện</span></div><div class="stat"><b>${meds.length}</b><span>Huy chương trong ngày</span></div>`;$('#vnAthleteList').innerHTML=APP_DATA.athletes.length?APP_DATA.athletes.map(a=>`<button class="athlete-chip" data-athlete-detail="${esc(a.name)}">👤 ${esc(a.name)}</button>`).join(''):'<div class="empty-card">Chưa có danh sách VĐV.</div>';$('#vnMedallistList').innerHTML=meds.length?meds.map(m=>`<div class="row"><div class="time">${esc(m.medal)}</div><div><b>${esc(m.name)}</b><div class="meta">${esc(m.sport)} • ${esc(m.event)}</div></div><div class="result">${esc(m.result)}</div></div>`).join(''):'<div class="empty-card">Chưa phát hiện huy chương Việt Nam trong ngày này.</div>';bindDetailButtons()}
function renderFavorites(){const el=$('#favoritesList');if(!el||!APP_DATA)return;const favs=getFavs(),items=allScheduleItems().filter(x=>favs.includes(x.id));el.innerHTML=items.length?items.map(x=>`<div style="padding:7px 0;border-bottom:1px solid #eef1f5"><b>${x.icon} ${sportButton(x.sport)}</b> • ${esc(x.time)}<br><span class="meta">${esc(x.event)} — ${athleteButton(x.athlete||x.vn)}</span></div>`).join(''):'Chưa có nội dung yêu thích. Vào Lịch đấu và bấm ☆ để lưu.';bindDetailButtons()}

function findAthlete(name){return APP_DATA?.athletes?.find(a=>a.name===name)}
function showAthlete(name){const a=findAthlete(name),related=allScheduleItems().filter(x=>(x.athlete||x.vn).includes(name)||name.includes(x.athlete||x.vn));$('#athleteDetail').innerHTML=a?`<div class="detail-hero"><div class="avatar">${a.avatar||'👤'}</div><div><h2>${esc(a.name)}</h2><div>Đoàn Việt Nam</div></div></div><div class="detail-grid"><div class="card"><h4>Thông tin</h4><div class="meta">Đơn vị: ${esc(a.team||'Đội tuyển Việt Nam')}</div></div><div class="card"><h4>Dữ liệu ASIAD 20</h4><div class="meta">Thông tin được tổng hợp từ lịch và kết quả chính thức Bornan.</div></div></div><section class="section"><div class="section-title"><h3>Lịch & kết quả</h3></div><div class="list">${related.length?related.map(x=>`<div class="row"><div class="time">${esc(x.time)}</div><div><b>${x.icon} ${esc(x.sport)}</b><div class="meta">${esc(x.event)} • ${esc(x.venue)}</div></div><div>${esc(x.result||statusLabel(x.status))}</div></div>`).join(''):'<div class="empty-card">Chưa có dữ liệu liên quan.</div>'}</div></section>`:`<div class="empty-card">Chưa có hồ sơ chi tiết.</div>`;go('athlete')}
function showSport(name){const events=allScheduleItems().filter(x=>x.sport===name);$('#sportDetail').innerHTML=`<div class="detail-hero"><div class="avatar">${events[0]?.icon||'🏅'}</div><div><h2>${esc(name)}</h2><div>ASIAD 20 Aichi–Nagoya 2026</div></div></div><section class="section"><div class="section-title"><h3>Lịch & kết quả của Việt Nam</h3></div><div class="list">${events.length?events.map(x=>`<div class="row"><div class="time">${esc(x.time)}</div><div><b>${esc(x.event)}</b><div class="ath">${athleteButton(x.athlete||x.vn)}</div><div class="meta">${esc(x.date)} • ${esc(x.venue)}</div></div><div>${esc(x.result||statusLabel(x.status))}</div></div>`).join(''):'<div class="empty-card">Chưa có nội dung.</div>'}</div></section>`;bindDetailButtons();go('sport')}
function bindDetailButtons(){$$('[data-athlete-detail]').forEach(b=>b.onclick=()=>showAthlete(b.dataset.athleteDetail));$$('[data-sport-detail]').forEach(b=>b.onclick=()=>showSport(b.dataset.sportDetail))}

async function requestNotifications(){if(!('Notification'in window)){alert('Trình duyệt không hỗ trợ thông báo.');return}const p=await Notification.requestPermission();renderReminderCenter();if(p==='granted')new Notification('ASIAD 20 Việt Nam',{body:'Đã bật nhắc sắp thi đấu.'})}
function renderReminderCenter(){const el=$('#reminderList');if(!el||!APP_DATA)return;const favs=getFavs(),now=new Date(),upcoming=APP_DATA.upcoming.filter(x=>favs.includes(x.id)).map(x=>({x,mins:Math.round((eventDate(x)-now)/60000)})).filter(o=>o.mins>=0).sort((a,b)=>a.mins-b.mins);const perm=('Notification'in window)?Notification.permission:'unsupported';$('#notifyState').textContent=perm==='granted'?'Đã bật thông báo trình duyệt':perm==='denied'?'Thông báo bị chặn':'Chưa bật thông báo trình duyệt';el.innerHTML=upcoming.length?upcoming.map(({x,mins})=>`<div class="row"><div class="time">${esc(x.time)}</div><div><b>${x.icon} ${esc(x.sport)}</b><div class="meta">${esc(x.event)} • ${esc(x.athlete||x.vn||'')}</div></div><div class="remind-tag">${mins<=REMINDER_MINUTES?`Còn ${mins} phút`:esc(x.date)}</div></div>`).join(''):'<div class="empty-card">Đánh dấu ★ một nội dung sắp thi đấu để nhận nhắc.</div>'}
function checkReminders(){if(!APP_DATA)return;const favs=getFavs(),state=getReminderState(),now=new Date();APP_DATA.upcoming.filter(x=>favs.includes(x.id)).forEach(x=>{const mins=(eventDate(x)-now)/60000;if(mins>=0&&mins<=REMINDER_MINUTES&&!state[x.id]){const msg=`${x.athlete||x.vn||'Việt Nam'} thi đấu ${x.sport} lúc ${x.time}`;showToast(`🔔 ${msg}`);if('Notification'in window&&Notification.permission==='granted')new Notification('ASIAD 20 - Sắp thi đấu',{body:msg});state[x.id]=new Date().toISOString();saveReminderState(state)}});renderReminderCenter()}
function showToast(message){const t=$('#toast');t.textContent=message;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),6000)}

async function refresh(date=''){const rb=$('#refreshBtn');if(rb){rb.disabled=true;rb.textContent='↻ Đang tải...'}$('#sourceLabel').textContent='Đang đồng bộ Bornan...';try{APP_DATA=await loadData(date);CURRENT_DATE=APP_DATA.meta.date||date;setStatus();renderLive(APP_DATA.live);renderRows('#upcomingList',APP_DATA.upcoming,'upcoming');renderRows('#latestList',APP_DATA.latest,'result');populateFilters();renderScheduleFiltered();renderLiveScreen();renderFavorites();renderVietnamTab();renderReminderCenter();checkReminders();renderHero();loadMedals(CURRENT_DATE).then(m=>{MEDAL_DATA=m;renderHero();renderMedals()}).catch(e=>{renderHero();renderMedals();const i=$('#medalSourceInfo');if(i)i.textContent=MEDAL_DATA?.rows?.length?'Không làm mới được bảng huy chương; đang giữ dữ liệu gần nhất.':'Chưa lấy được bảng tổng sắp; đang hiển thị huy chương phát hiện trong ngày.';console.warn(e)})}catch(err){$('#sourceLabel').textContent='Lỗi tải dữ liệu';$('#lastUpdated').textContent=err?.message||String(err);console.error(err)}finally{if(rb){rb.disabled=false;rb.textContent='↻ Làm mới'}}}

const screens=$$('.screen'),navButtons=$$('nav button');
function go(id){screens.forEach(s=>s.classList.toggle('active',s.id===id));navButtons.forEach(b=>b.classList.toggle('active',b.dataset.go===id));window.scrollTo({top:0,behavior:'smooth'})}
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
$('#refreshBtn')?.addEventListener('click',()=>refresh(''));

$('#officialBtn')?.addEventListener(
  'click',
  ()=>window.open(CONFIG.officialSite,'_blank','noopener')
);

// Chỉ khi người dùng chủ động chọn một ngày
// thì mới tải đúng ngày đã chọn.
$('#loadDate')?.addEventListener('click',()=>{
  const d=$('#dateFilter')?.value||'';
  refresh(d);
});

['sportFilter','statusFilter'].forEach(id=>
  $('#'+id)?.addEventListener('change',renderScheduleFiltered)
);

$('#clearFilters')?.addEventListener('click',()=>{
  $('#sportFilter').value='';
  $('#statusFilter').value='';
  renderScheduleFiltered();
});

$('#enableNotify')?.addEventListener(
  'click',
  requestNotifications
);


// ============================================================
// AUTO REFRESH
// ============================================================

let AUTO_REFRESHING=false;


// Kiểm tra nhắc lịch mỗi 60 giây
setInterval(checkReminders,60000);


// Tự động đồng bộ dữ liệu mỗi 60 giây
setInterval(async()=>{

  if(AUTO_REFRESHING || document.hidden){
    return;
  }

  AUTO_REFRESHING=true;

  try{

    // QUAN TRỌNG:
    // Không truyền CURRENT_DATE.
    //
    // Khi date = '', request sẽ là:
    // /api/data
    //
    // Server sẽ tự xác định ngày hiện tại
    // theo múi giờ Asia/Tokyo.
    //
    // Vì vậy khi sang ngày mới,
    // ứng dụng sẽ tự chuyển ngày.
    await refresh('');

  }finally{

    AUTO_REFRESHING=false;

  }

},60000);


// Khi người dùng quay lại tab,
// đồng bộ lại ngày hiện tại từ server.
document.addEventListener('visibilitychange',()=>{

  if(!document.hidden && APP_DATA){

    refresh('');

  }

});


// ============================================================
// INITIAL LOAD
// ============================================================

// Lần mở trang đầu tiên cũng để server
// tự xác định ngày hiện tại.
refresh('');
