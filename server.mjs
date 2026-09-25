import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { URL } from "node:url";
import { chromium } from "playwright";

const PORT = Number(process.env.PORT || 8787);
const ROOT = process.cwd();
const OFFICIAL_BASE = "https://back.results.asiangames2026.org/s/AG2026/en";
const OFFICIAL_SITE = "https://results.asiangames2026.org/";
const VIE = "VIE";
const CACHE_MS = 60_000;
const MEDAL_CACHE_MS = 10 * 60_000;
const HTTP_TIMEOUT_MS = 20_000;
const CACHE_DIR = path.join(ROOT, ".cache");
fs.mkdirSync(CACHE_DIR,{recursive:true});
const MAX_CONCURRENCY = 8;
const cache = new Map();
let discoveredMedalEndpoint = "";

const SPORT_ICONS = {VBV:"🏐",ROW:"🚣",FEN:"🤺",ATH:"🏃",SWM:"🏊",ELS:"🎮",BOX:"🥊",WLF:"🏋️",CSP:"🛶",BDM:"🏸",BKB:"🏀",FBL:"⚽",VVO:"🏐",TTN:"🏓",TEN:"🎾",JUD:"🥋",TKW:"🥋",WRE:"🤼",ARC:"🏹",SHO:"🎯",GYM:"🤸",CTR:"🚴",TRI:"🏊",HOC:"🏑",WPO:"🤽",RUG:"🏉",GLF:"⛳",CLB:"🧗",KTE:"🥋",JJI:"🥋",SQH:"🏸"};
const SPORT_VI = {
  VBV:"Bóng chuyền bãi biển", ROW:"Chèo thuyền", FEN:"Đấu kiếm", ATH:"Điền kinh", SWM:"Bơi lội", ELS:"Thể thao điện tử", BOX:"Quyền Anh", WLF:"Cử tạ", CSP:"Canoe/Kayak tốc độ",
  BDM:"Cầu lông", BKB:"Bóng rổ", FBL:"Bóng đá", VVO:"Bóng chuyền", TTN:"Bóng bàn", TEN:"Quần vợt", JUD:"Judo", TKW:"Taekwondo", WRE:"Vật", ARC:"Bắn cung", SHO:"Bắn súng", GYM:"Thể dục dụng cụ", CTR:"Xe đạp", TRI:"Ba môn phối hợp", HOC:"Khúc côn cầu", WPO:"Bóng nước", RUG:"Bóng bầu dục 7 người", GLF:"Golf", CLB:"Leo núi thể thao", KTE:"Karate", JJI:"Jujitsu", SQH:"Squash"
};
const ORG_VI = {
  VIE:"Việt Nam", CHN:"Trung Quốc", JPN:"Nhật Bản", KOR:"Hàn Quốc", PRK:"Triều Tiên", THA:"Thái Lan", INA:"Indonesia", PHI:"Philippines", SGP:"Singapore", MAS:"Malaysia", HKG:"Hồng Kông, Trung Quốc", TPE:"Đài Bắc Trung Hoa", IND:"Ấn Độ", KAZ:"Kazakhstan", UZB:"Uzbekistan", IRI:"Iran", IRQ:"Iraq", KSA:"Ả Rập Xê Út", QAT:"Qatar", UAE:"UAE", OMA:"Oman", LBN:"Liban", BAN:"Bangladesh", MGL:"Mông Cổ", CAM:"Campuchia", LAO:"Lào", MYA:"Myanmar", NEP:"Nepal", PAK:"Pakistan", BRN:"Bahrain", KUW:"Kuwait", JOR:"Jordan", TJK:"Tajikistan", KGZ:"Kyrgyzstan", TKM:"Turkmenistan", MAC:"Ma Cao", PLE:"Palestine", AFG:"Afghanistan", SYR:"Syria", MDV:"Maldives", TLS:"Timor-Leste", BHU:"Bhutan", YEM:"Yemen"
};

function cacheFile(name){return path.join(CACHE_DIR,name);}
function writeSnapshot(name,data){try{fs.writeFileSync(cacheFile(name),JSON.stringify(data,null,2),"utf8")}catch{}}
function readSnapshot(name){try{return JSON.parse(fs.readFileSync(cacheFile(name),"utf8"))}catch{return null}}

function viText(s="") {
  let x = String(s || "");

  const rules = [

    // --------------------------------------------------------
    // ĐƠN / ĐÔI / ĐỒNG ĐỘI
    // Cụm dài phải được xử lý trước từ ngắn.
    // --------------------------------------------------------

    [/\bWomen(?:'s)?\s+Doubles\b/gi,"Đôi nữ"],
    [/\bMen(?:'s)?\s+Doubles\b/gi,"Đôi nam"],
    [/\bMixed\s+Doubles\b/gi,"Đôi nam nữ"],

    [/\bWomen(?:'s)?\s+Singles\b/gi,"Đơn nữ"],
    [/\bMen(?:'s)?\s+Singles\b/gi,"Đơn nam"],

    [/\bWomen(?:'s)?\s+Team\b/gi,"Đồng đội nữ"],
    [/\bMen(?:'s)?\s+Team\b/gi,"Đồng đội nam"],
    [/\bMixed\s+Team\b/gi,"Đồng đội hỗn hợp"],


    // --------------------------------------------------------
    // TRẬN HUY CHƯƠNG / PHÂN HẠNG
    // --------------------------------------------------------

    [/Gold Medal Match/gi,"Trận tranh HCV"],
    [/Bronze Medal Match/gi,"Trận tranh HCĐ"],
    [/Classification Match/gi,"Trận phân hạng"],


    // --------------------------------------------------------
    // VÒNG ĐẤU
    // --------------------------------------------------------

    [/Round Robin/gi,"Vòng tròn"],
    [/^Round$/gi,"Vòng"],

    [/Preliminary Phase/gi,"Vòng sơ loại"],
    [/Preliminaries/gi,"Vòng sơ loại"],

    [/Qualification Round/gi,"Vòng loại"],
    [/Qualifying Round/gi,"Vòng loại"],

    [/Round of Pool\s*(\d*)/gi,
      (_,n) => "Vòng bảng" + (n ? " " + n : "")],

    [/Round of 32/gi,"Vòng 32"],
    [/Round of 16/gi,"Vòng 16"],

    [/Table of 32/gi,"Vòng 32"],
    [/Table of 16/gi,"Vòng 16"],

    [/Quarter-?finals?/gi,"Tứ kết"],
    [/Semi-?finals?/gi,"Bán kết"],

    // Phải xử lý Final A/B trước Final.
    [/Final A/gi,"Chung kết A"],
    [/Final B/gi,"Chung kết B"],
    [/Finals/gi,"Chung kết"],
    [/Final/gi,"Chung kết"],

    [/1st Round/gi,"Vòng 1"],
    [/2nd Round/gi,"Vòng 2"],
    [/3rd Round/gi,"Vòng 3"],
    [/4th Round/gi,"Vòng 4"],

    [/Round\s*(\d+)/gi,"Vòng $1"],


    // --------------------------------------------------------
    // HEAT
    // --------------------------------------------------------

    [/Heats/gi,"Vòng loại"],
    [/Heat\s*(\d+)/gi,"Lượt $1"],


    // --------------------------------------------------------
    // GROUP / POOL
    // --------------------------------------------------------

    [/Group\s*A/gi,"Bảng A"],
    [/Group\s*B/gi,"Bảng B"],
    [/Group\s*C/gi,"Bảng C"],
    [/Group\s*D/gi,"Bảng D"],

    [/Pool\s*A/gi,"Bảng A"],
    [/Pool\s*B/gi,"Bảng B"],
    [/Pool\s*C/gi,"Bảng C"],
    [/Pool\s*D/gi,"Bảng D"],


    // --------------------------------------------------------
    // MATCH / BOUT
    // --------------------------------------------------------

    [/Match\s*(\d+)/gi,"Trận $1"],
    [/Bout\s*(\d+)/gi,"Trận $1"],


    // --------------------------------------------------------
    // GIỚI TÍNH
    // --------------------------------------------------------

    [/\bWomen's\b/gi,"Nữ"],
    [/\bMen's\b/gi,"Nam"],

    [/\bWomen\b/gi,"Nữ"],
    [/\bMen\b/gi,"Nam"],

    [/\bMixed\b/gi,"Hỗn hợp"],


    // --------------------------------------------------------
    // LOẠI NỘI DUNG
    // --------------------------------------------------------

    [/\bIndividual\b/gi,"Cá nhân"],
    [/\bTeam\b/gi,"Đồng đội"],

    [/\bSingles\b/gi,"Đơn"],
    [/\bDoubles\b/gi,"Đôi"],


    // --------------------------------------------------------
    // MỘT SỐ MÔN / THUẬT NGỮ
    // --------------------------------------------------------

    [/Handball/gi,"Bóng ném"],

    [/Épée/gi,"Kiếm ba cạnh"],
    [/Epee/gi,"Kiếm ba cạnh"],


    // --------------------------------------------------------
    // BƠI
    // --------------------------------------------------------

    [/Freestyle/gi,"tự do"],
    [/Butterfly/gi,"bơi bướm"],
    [/Breaststroke/gi,"bơi ếch"],
    [/Backstroke/gi,"bơi ngửa"],
    [/Medley/gi,"hỗn hợp"],
    [/Relay/gi,"tiếp sức"],


    // --------------------------------------------------------
    // ĐIỀN KINH
    // --------------------------------------------------------

    [/Heptathlon/gi,"bảy môn phối hợp"],


    // --------------------------------------------------------
    // CHÈO THUYỀN
    // --------------------------------------------------------

    [/Single Sculls/gi,"thuyền đơn"],
    [/Double Sculls/gi,"thuyền đôi"],
    [/Quadruple Sculls/gi,"thuyền bốn mái chèo"],

    [/Pair/gi,"đôi"],
    [/Four/gi,"bốn người"],


    // --------------------------------------------------------
    // CANOE / KAYAK
    // --------------------------------------------------------

    [/Kayak Single/gi,"kayak đơn"],
    [/Kayak Double/gi,"kayak đôi"],


    // --------------------------------------------------------
    // ESPORTS
    // --------------------------------------------------------

    [/Action-adventure/gi,"Hành động phiêu lưu"],
    [/Battle Royale/gi,"Sinh tồn"]

  ];

  for (const [re, rep] of rules) {
    x = x.replace(re, rep);
  }

  return x
    .replace(/\s+/g," ")
    .replace(/\s+•\s+/g," • ")
    .trim();
}


// ============================================================
// compactEvent()
//
// Mục đích:
// - bỏ phần lặp
// - Nam • Tứ kết • Nam Tứ kết
//     => Nam • Tứ kết
//
// - Nữ 54kg • Vòng sơ loại - Vòng 16
//   • Vòng sơ loại - Vòng 16
//     => Nữ 54kg • Vòng sơ loại - Vòng 16
//
// - Nam Kayak Đôi 500m • Chung kết • Chung kết A
//     => Nam Kayak Đôi 500m • Chung kết A
//
// - Nữ Épée Đồng đội • Tứ kết • Tứ kết 4
//     => Nữ Kiếm ba cạnh Đồng đội • Tứ kết 4
// ============================================================

function compactEvent(event="", phase="", unit="") {

  let parts = [event, phase, unit]
    .map(v =>
      String(v || "")
        .replace(/\s+/g," ")
        .trim()
    )
    .filter(Boolean);

  if (!parts.length) {
    return "";
  }


  // ----------------------------------------------------------
  // A. Nếu phase/unit bắt đầu bằng nguyên event thì bỏ event
  //    bị lặp ở đầu.
  //
  // Ví dụ:
  // event = "Nam"
  // unit  = "Nam Tứ kết"
  //
  // => unit = "Tứ kết"
  // ----------------------------------------------------------

  const base = parts[0].toLocaleLowerCase("vi");

  for (let i = 1; i < parts.length; i++) {

    const low = parts[i].toLocaleLowerCase("vi");

    if (low.startsWith(base + " ")) {
      parts[i] =
        parts[i]
          .slice(parts[0].length)
          .trim();
    }
  }


  // ----------------------------------------------------------
  // B. Bỏ phần giống hệt nhau.
  // ----------------------------------------------------------

  const unique = [];

  for (const p of parts.filter(Boolean)) {

    const low = p.toLocaleLowerCase("vi");

    const exists = unique.some(
      x => x.toLocaleLowerCase("vi") === low
    );

    if (!exists) {
      unique.push(p);
    }
  }


  // ----------------------------------------------------------
  // C. Nếu phần sau chi tiết hơn phần trước thì bỏ phần trước.
  //
  // Chung kết + Chung kết A
  // => Chung kết A
  //
  // Tứ kết + Tứ kết 4
  // => Tứ kết 4
  // ----------------------------------------------------------

  const keep = unique.filter((p, i) => {

    // Nội dung thi đấu đầu tiên luôn được giữ.
    if (i === 0) {
      return true;
    }

    const low = p.toLocaleLowerCase("vi");

    const hasMoreDetailedLaterPart =
      unique.some((q, j) => {

        if (j <= i) {
          return false;
        }

        const ql =
          q.toLocaleLowerCase("vi");

        return (
          ql === low ||
          ql.startsWith(low + " ") ||
          ql.startsWith(low + " -") ||
          ql.startsWith(low + ":")
        );
      });

    return !hasMoreDetailedLaterPart;
  });


  // ----------------------------------------------------------
  // D. Ghép lại.
  // ----------------------------------------------------------

  return keep
    .join(" • ")
    .replace(/\s+/g," ")
    .replace(/\s+•\s+/g," • ")
    .trim();
}

function sportVi(code, desc="") { return SPORT_VI[code] || viText(desc) || code || "ASIAD 20"; }
function orgVi(code, desc="") { return ORG_VI[code] || desc || code || ""; }
function medalLabel(m){ return m==="ME_GOLD"?"🥇 HCV":m==="ME_SILVER"?"🥈 HCB":m==="ME_BRONZE"?"🥉 HCĐ":""; }
function viTimeParts(iso){
  const d=new Date(iso); const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d);
  const v=Object.fromEntries(parts.map(p=>[p.type,p.value])); return {date:`${v.year}-${v.month}-${v.day}`,time:`${v.hour}:${v.minute}`};
}

function repairUtf8Expanded(buf) {
  const s = buf.toString("utf8"); const out = [];
  for (const ch of s) { const cp = ch.codePointAt(0); if (cp > 255) throw new Error(`Cannot repair code point U+${cp.toString(16)}`); out.push(cp); }
  return Buffer.from(out);
}
function tryJson(buf) { try { return JSON.parse(buf.toString("utf8").replace(/^\uFEFF/, "").trim()); } catch { return null; } }
function decodeBornan(raw) {
  const variants = [["direct", raw]]; try { variants.push(["repaired", repairUtf8Expanded(raw)]); } catch {}
  const methods = [["plain", b=>b],["inflate", b=>zlib.inflateSync(b)],["inflateRaw", b=>zlib.inflateRawSync(b)],["gunzip", b=>zlib.gunzipSync(b)],["brotli", b=>zlib.brotliDecompressSync(b)]];
  for (const [vn,vb] of variants) for (const [mn,fn] of methods) try { const decoded=fn(vb); const obj=tryJson(decoded); if(obj!==null) return {data:obj,decoder:`${vn}+${mn}`}; } catch {}
  throw new Error("Bornan payload could not be decoded");
}
async function bornanGet(url) {
  const r = await fetch(url,{signal:AbortSignal.timeout(HTTP_TIMEOUT_MS),headers:{accept:"application/json, text/plain, */*","accept-language":"en-US,en;q=0.9",origin:OFFICIAL_SITE.replace(/\/$/,""),referer:OFFICIAL_SITE,"user-agent":"Mozilla/5.0"}});
  if(!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  const raw=Buffer.from(await r.arrayBuffer()); return {...decodeBornan(raw),status:r.status,url};
}
function japanDateISO(){ const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()); const v=Object.fromEntries(parts.map(p=>[p.type,p.value])); return `${v.year}-${v.month}-${v.day}`; }
async function mapLimit(items,limit,fn){ const results=new Array(items.length); let next=0; async function worker(){while(true){const i=next++;if(i>=items.length)return;try{results[i]=await fn(items[i],i)}catch(e){results[i]={__error:e.message}}}} await Promise.all(Array.from({length:Math.min(limit,items.length)},worker)); return results; }
function normalizeStatus(item,now=new Date()){ if(item?.IsLive)return"live"; const s=String(item?.Status||"").toUpperCase(); if(["OFFICIAL","UNOFFICIAL","FINISHED","CLOSED"].includes(s))return"finished"; const dt=item?.DateTimeRaw?new Date(item.DateTimeRaw):null; if(dt&&dt>now)return"upcoming"; return"scheduled"; }
function normalizeVieResult(resultObj){ const comps=Array.isArray(resultObj?.Competitors)?resultObj.Competitors:[]; return comps.filter(c=>c?.Org===VIE).map(c=>({reg:c.Reg||"",name:c.Name||c.NameS||"",org:c.Org||"",orgDesc:c.OrgDesc||"Vietnam",rank:c.Rk||c.RkPo||"",result:c.Result||"",lane:c.Lane||"",medal:c.Medal||"",qualified:c.Qualified||"",irm:c.IRM||""})); }
function normalizeUnit(scheduleItem,unitObj,resultObj){
  const current=Array.isArray(unitObj?.phase)?unitObj.phase.find(x=>x?.ResCode===(scheduleItem.ResCode||scheduleItem.Key))||null:null;
  const orgs=current?.Orgs||[]; const quickResults=Array.isArray(current?.Results)?current.Results:[]; const vieQuick=quickResults.filter(r=>r?.Org===VIE); const vieDetailed=resultObj?normalizeVieResult(resultObj):[]; const info=resultObj?.Info||current||scheduleItem;
  return {resCode:scheduleItem.ResCode||scheduleItem.Key||"",disc:scheduleItem.Disc||info?.Disc||"",sport:sportVi(scheduleItem.Disc||info?.Disc,scheduleItem.DiscDesc||info?.DiscDesc),event:viText(scheduleItem.EventDesc||info?.EventDesc||""),phase:viText(scheduleItem.PhaseDescA||scheduleItem.PhaseDesc||info?.PhaseDescA||info?.PhaseDesc||""),unit:viText(scheduleItem.UnitDescA||scheduleItem.UnitDesc||info?.UnitDescA||info?.UnitDesc||""),dateTime:scheduleItem.DateTimeRaw||info?.DateTimeRaw||"",venue:scheduleItem.VenueDescS||scheduleItem.VenueDesc||info?.VenueDescS||info?.VenueDesc||"",location:scheduleItem.LocDescS||scheduleItem.LocDesc||info?.LocDescS||info?.LocDesc||"",status:normalizeStatus({...scheduleItem,...info}),sourceStatus:info?.Status||scheduleItem.Status||"",isLive:Boolean(info?.IsLive||scheduleItem.IsLive),medalEvent:String(info?.Medal??scheduleItem.Medal??"")!=="0"&&String(info?.Medal??scheduleItem.Medal??"")!=="",orgs,vietnam:vieDetailed.length?vieDetailed:vieQuick.map(r=>({reg:r.Reg||"",name:r.Name||r.NameS||"",org:r.Org||VIE,orgDesc:"Vietnam",rank:r.Rk||r.RkPo||"",result:r.Result||"",lane:"",medal:"",qualified:"",irm:""}))};
}
async function collectVietnam(date){
  const key=`vie:${date}`; const hit=cache.get(key); if(hit&&Date.now()-hit.ts<CACHE_MS)return hit.value;
  const schedule=(await bornanGet(`${OFFICIAL_BASE}/ALL/schedule/day/${date}`)).data; const candidates=(Array.isArray(schedule)?schedule:[]).filter(x=>!x?.IsPhase&&(x?.ResCode||x?.Key));
  const unitChecks=await mapLimit(candidates,MAX_CONCURRENCY,async item=>{ const resCode=item.ResCode||item.Key,disc=item.Disc; const unitResp=await bornanGet(`${OFFICIAL_BASE}/${encodeURIComponent(disc)}/schedule/unit/${encodeURIComponent(resCode)}`); const phase=Array.isArray(unitResp.data?.phase)?unitResp.data.phase:[]; const current=phase.find(x=>x?.ResCode===resCode); const orgs=current?.Orgs||[]; if(!orgs.includes(VIE))return null; let resultObj=null; try{resultObj=(await bornanGet(`${OFFICIAL_BASE}/${encodeURIComponent(disc)}/results/${encodeURIComponent(resCode)}`)).data}catch{} return normalizeUnit(item,unitResp.data,resultObj); });
  const events=unitChecks.filter(x=>x&&!x.__error).sort((a,b)=>String(a.dateTime).localeCompare(String(b.dateTime)));
  const value={provider:"Bornan / Aichi-Nagoya 2026 official results",official:true,org:VIE,date,updatedAt:new Date().toISOString(),counts:{total:events.length,live:events.filter(x=>x.status==="live").length,upcoming:events.filter(x=>x.status==="upcoming"||x.status==="scheduled").length,finished:events.filter(x=>x.status==="finished").length},events};
  cache.set(key,{ts:Date.now(),value}); writeSnapshot(`vietnam-${date}.json`,value); return value;
}
function toAppEvent(e){ const t=viTimeParts(e.dateTime); const vn=e.vietnam||[]; const names=vn.map(x=>x.name).filter(Boolean).join(" / ")||"Việt Nam"; const medals=vn.map(x=>medalLabel(x.medal)).filter(Boolean); const result=vn.map(x=>x.result).filter(x=>x!=="").join(" • "); return {id:e.resCode,date:t.date,time:t.time,status:e.status==="finished"?"done":e.status,icon:SPORT_ICONS[e.disc]||"🏅",sport:e.sport,event:compactEvent(e.event,e.phase,e.unit),athlete:names,vn:names,opponent:(e.orgs||[]).filter(x=>x!==VIE).map(c=>orgVi(c)).join(" / "),opponentCodes:(e.orgs||[]).filter(x=>x!==VIE),score:result||"—",detail:medals.join(" • ")|| (e.sourceStatus==="OFFICIAL"?"Chính thức":e.sourceStatus||""),venue:e.venue||e.location||"",result:medals.join(" • ")||result||(e.sourceStatus==="OFFICIAL"?"Chính thức":e.sourceStatus||"")}; }
function dailyMedalSummary(raw){ let gold=0,silver=0,bronze=0; const medallists=[]; for(const e of raw.events)for(const v of(e.vietnam||[])){if(v.medal==="ME_GOLD")gold++;else if(v.medal==="ME_SILVER")silver++;else if(v.medal==="ME_BRONZE")bronze++;if(v.medal)medallists.push({name:v.name||"Việt Nam",sport:e.sport,event:e.event,medal:medalLabel(v.medal),result:v.result||"",resCode:e.resCode});} return {gold,silver,bronze,total:gold+silver+bronze,medallists}; }
function buildAppData(raw){ const mapped=raw.events.map(toAppEvent); const live=mapped.filter(x=>x.status==="live"); const upcoming=mapped.filter(x=>x.status==="upcoming"||x.status==="scheduled"); const latest=mapped.filter(x=>x.status==="done").sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time)); const d=dailyMedalSummary(raw); const athletes=[...new Set(raw.events.flatMap(e=>(e.vietnam||[]).map(v=>v.name)).filter(n=>n&&n!=="Vietnam"))].map(name=>({name,sport:"ASIAD 20",gender:"",team:"Đội tuyển Việt Nam",highlights:[]})); const sports=[...new Set(mapped.map(x=>x.sport))].sort(); return {meta:{label:"Dữ liệu thi đấu Bornan chính thức • tự động 60 giây",sourceMode:"official-live",lastUpdated:raw.updatedAt,date:raw.date},vietnam:{rank:"—",gold:d.gold,silver:d.silver,bronze:d.bronze,total:d.total},sports,sportDetails:[],athletes,live,upcoming,latest,medals:[{rank:"—",country:"🇻🇳 Việt Nam (trong ngày)",org:"VIE",gold:d.gold,silver:d.silver,bronze:d.bronze,total:d.total,isVietnam:true}],dailyMedallists:d.medallists,counts:raw.counts}; }

function n(v){ const x=Number(v); return Number.isFinite(x)?x:0; }
function lowerKeys(o){ const m={}; for(const [k,v] of Object.entries(o||{}))m[String(k).toLowerCase()]=v; return m; }

function flattenScalars(obj,prefix="",out={}){
  if(obj===null||obj===undefined)return out;
  if(typeof obj!=="object"){out[prefix.toLowerCase()]=obj;return out;}
  if(Array.isArray(obj)){
    obj.forEach((v,i)=>flattenScalars(v,`${prefix}[${i}]`,out));
    return out;
  }
  for(const [k,v] of Object.entries(obj)){
    const p=prefix?`${prefix}.${k}`:k;
    if(v!==null&&typeof v==="object")flattenScalars(v,p,out);
    else out[p.toLowerCase()]=v;
  }
  return out;
}

function pickByPath(flat, patterns){
  for(const [k,v] of Object.entries(flat)){
    if(patterns.some(rx=>rx.test(k))) return v;
  }
  return undefined;
}

function medalCountsFromRow(row){
  const flat=flattenScalars(row);
  let gold=n(pickByPath(flat,[/(^|\.)(gold|g)(\.|$)/, /gold.*(count|medal|total|value)/, /(count|medal|total|value).*gold/])),
      silver=n(pickByPath(flat,[/(^|\.)(silver|s)(\.|$)/, /silver.*(count|medal|total|value)/, /(count|medal|total|value).*silver/])),
      bronze=n(pickByPath(flat,[/(^|\.)(bronze|b)(\.|$)/, /bronze.*(count|medal|total|value)/, /(count|medal|total|value).*bronze/]));

  // Bornan sometimes returns a medal array/object rather than direct scalar counts.
  function walkMedals(x){
    if(!x||typeof x!=="object") return;
    if(Array.isArray(x)){ for(const y of x) walkMedals(y); return; }
    const m=lowerKeys(x);
    const type=String(m.type??m.code??m.medal??m.name??m.desc??m.description??"").toUpperCase();
    const count=n(m.count??m.value??m.total??m.number??m.qty??m.quantity??0);
    if(type.includes("GOLD") && count) gold=Math.max(gold,count);
    if(type.includes("SILVER") && count) silver=Math.max(silver,count);
    if(type.includes("BRONZE") && count) bronze=Math.max(bronze,count);
    for(const v of Object.values(x)) if(v&&typeof v==="object") walkMedals(v);
  }
  walkMedals(row);

  // V1.9.4: Bornan's payload contains another numeric field that V1.9.3
  // could mistake for total medals. Never trust an ambiguous `total` key here.
  // The medal-table total is defined deterministically as Gold + Silver + Bronze.
  const total=gold+silver+bronze;
  return {gold,silver,bronze,total};
}

function inferOrg(row,keyHint=""){
  const flat=flattenScalars(row);
  const direct = [
    row?.Org,row?.NOC,row?.Code,row?.OrgCode,row?.OrganisationCode,row?.OrganizationCode,
    row?.Organisation,row?.Organization,row?.Noc,row?.NocCode
  ].filter(Boolean);
  for(const v of direct){ const s=String(v).toUpperCase(); if(/^[A-Z]{3}$/.test(s)) return s; }

  for(const [k,v] of Object.entries(flat)){
    const s=String(v??"").toUpperCase();
    if(/^[A-Z]{3}$/.test(s) && /(org|noc|country|organisation|organization|code)/.test(k)) return s;
  }
  const h=String(keyHint||"").toUpperCase();
  return /^[A-Z]{3}$/.test(h)?h:"";
}

function inferCountry(row,org){
  const flat=flattenScalars(row);
  const direct=[row?.OrgDesc,row?.Country,row?.Name,row?.Description,row?.Desc,row?.OrganisationDesc,row?.OrganizationDesc].filter(Boolean);
  if(direct.length) return String(direct[0]);
  const v=pickByPath(flat,[/(orgdesc|countryname|organisationdesc|organizationdesc|description|desc|name)$/]);
  return String(v??org??"");
}

function inferRank(row){
  const flat=flattenScalars(row);
  const direct=row?.Rank??row?.Rk??row?.Position??row?.Pos;
  if(direct!==undefined&&direct!==null&&direct!=="")return String(direct);
  const v=pickByPath(flat,[/(^|\.)(rank|rk|position|pos)(\.|$)/]);
  return v!==undefined&&v!==null&&v!==""?String(v):"—";
}

function normalizeMedalRow(row,keyHint=""){
  const org=inferOrg(row,keyHint);
  const country=inferCountry(row,org);
  const rank=inferRank(row);
  const c=medalCountsFromRow(row);
  return {rank,country:orgVi(org,country),org,gold:c.gold,silver:c.silver,bronze:c.bronze,total:c.total,isVietnam:org===VIE||/vietnam|việt nam/i.test(country)};
}

function looksLikeOrgCode(k){return /^[A-Z]{3}$/.test(String(k||"").toUpperCase());}

function objectMapToRows(obj){
  if(!obj||Array.isArray(obj)||typeof obj!=="object")return[];
  const entries=Object.entries(obj); if(entries.length<3)return[];
  const orgEntries=entries.filter(([k,v])=>looksLikeOrgCode(k)&&v&&typeof v==="object"&&!Array.isArray(v));
  if(orgEntries.length<3)return[];
  return orgEntries.map(([k,v])=>normalizeMedalRow(v,k)).filter(r=>r.total>0||r.gold||r.silver||r.bronze);
}

function scoreMedalRows(rows){
  if(!Array.isArray(rows)||!rows.length)return 0;
  let score=0;
  for(const r of rows.slice(0,60)){
    if(!r||typeof r!=="object")continue;
    const nr=normalizeMedalRow(r);
    if(nr.org||nr.country)score+=2;
    if(nr.total>0||nr.gold||nr.silver||nr.bronze)score+=5;
    if(nr.isVietnam)score+=3;
    const keys=Object.keys(flattenScalars(r));
    if(keys.some(k=>/gold|silver|bronze|medal|rank|noc|org|organisation|organization/.test(k)))score+=2;
  }
  return score;
}

function findMedalRows(obj){
  let best=[],bestScore=0; const seen=new Set();
  function consider(rows){
    if(!Array.isArray(rows)||rows.length<2)return;
    const s=scoreMedalRows(rows);
    if(s>bestScore){best=rows;bestScore=s;}
  }
  function walk(x,depth=0){
    if(!x||typeof x!=="object"||depth>12||seen.has(x))return;
    seen.add(x);
    if(Array.isArray(x)){
      consider(x);
      for(const y of x.slice(0,200))walk(y,depth+1);
      return;
    }
    const mapped=objectMapToRows(x);
    if(mapped.length)consider(mapped);
    for(const v of Object.values(x))walk(v,depth+1);
  }
  walk(obj);

  if(!best.length)return[];
  const rows=best.map(r=>normalizeMedalRow(r)).filter(r=>(r.org||r.country)&&(r.total>0||r.gold||r.silver||r.bronze));
  const uniq=[]; const seenOrg=new Set();
  for(const r of rows){
    const key=r.org||r.country;
    if(seenOrg.has(key))continue;
    seenOrg.add(key); uniq.push(r);
  }
  uniq.sort((a,b)=>{
    const ra=parseInt(a.rank),rb=parseInt(b.rank);
    if(Number.isFinite(ra)&&Number.isFinite(rb))return ra-rb;
    return b.gold-a.gold||b.silver-a.silver||b.bronze-a.bronze;
  });
  return uniq;
}

function decodeAnyBody(raw){
  try{return decodeBornan(raw).data}catch{}
  const j=tryJson(raw); if(j!==null)return j;
  return null;
}

function summarizeShape(x,depth=0){
  if(depth>4)return typeof x;
  if(Array.isArray(x)) return {type:"array",length:x.length,sample:x.slice(0,3).map(v=>summarizeShape(v,depth+1))};
  if(x&&typeof x==="object"){
    const o={type:"object",keys:Object.keys(x).slice(0,30)};
    for(const k of Object.keys(x).slice(0,12)) o[k]=summarizeShape(x[k],depth+1);
    return o;
  }
  return x;
}

async function fetchKnownMedalPayload(){
  const url=`${OFFICIAL_BASE}/ALL/medals/standings`;
  const r=await bornanGet(url);
  discoveredMedalEndpoint=url;
  return {url,data:r.data,rows:findMedalRows(r.data)};
}
async function tryDirectMedalEndpoints(){
  // V1.9.4: endpoint da duoc browser discovery xac nhan chinh xac.
  try{
    const known=await fetchKnownMedalPayload();
    if(known.rows.length>=2) return {rows:known.rows,url:known.url,method:"known-endpoint"};
  }catch{}

  const tails=[
    "medals/standings","medals/table","medals/rank","medals/ranking","medals/medal-table","medals/table/noc","medals/noc",
    "medal/table","medal/standings","medal/rank","medal/ranking","medal-table","medal-standing","medalstandings",
    "medals","medals/list","medallists","medallists/list","noc/medals","orgs/medals"
  ];
  for(const tail of [...new Set(tails)]){
    const url=tail.startsWith("http")?tail:`${OFFICIAL_BASE}/ALL/${tail}`;
    try{
      const r=await bornanGet(url);
      const rows=findMedalRows(r.data);
      if(rows.length>=2){discoveredMedalEndpoint=url;return{rows,url,method:"direct"};}
    }catch{}
  }
  return null;
}
function orgFromCountryText(text){
  const t=String(text||"").toLowerCase();
  for(const [code,name] of Object.entries(ORG_VI)) if(t.includes(String(name).toLowerCase()))return code;
  const en={VIE:["vietnam","viet nam"],CHN:["china","people's republic of china"],JPN:["japan"],KOR:["korea","republic of korea"],PRK:["dpr korea","democratic people's republic of korea"],THA:["thailand"],INA:["indonesia"],IND:["india"],UZB:["uzbekistan"],KAZ:["kazakhstan"],TPE:["chinese taipei"],HKG:["hong kong"],SGP:["singapore"],MAS:["malaysia"],PHI:["philippines"]};
  for(const [code,names] of Object.entries(en))if(names.some(n=>t.includes(n)))return code;
  return "";
}
function parseDomMedalRows(textRows){
  const out=[];
  for(const raw of textRows||[]){
    const txt=String(raw||"").replace(/\s+/g," ").trim(); if(!txt)continue;
    const nums=[...txt.matchAll(/(?:^|\s)(\d{1,3})(?=\s|$)/g)].map(m=>Number(m[1]));
    if(nums.length<4)continue;
    const org=orgFromCountryText(txt); if(!org)continue;
    const last=nums.slice(-4); const [gold,silver,bronze,total]=last;
    const rank=String(nums[0]||"—");
    out.push({rank,country:orgVi(org,org),org,gold,silver,bronze,total,isVietnam:org===VIE});
  }
  const uniq=[]; const seen=new Set(); for(const r of out){if(seen.has(r.org))continue;seen.add(r.org);uniq.push(r)}
  return uniq;
}
async function discoverMedalsWithBrowser(){
  let browser; const candidates=[]; const debug=[]; let clicked=false; let fatalError="";
  try{
    browser=await chromium.launch({headless:true});
    const page=await browser.newPage();
    let collecting=false;
    page.on("response",async resp=>{
      if(!collecting)return;
      try{
        const req=resp.request();
        if(!["xhr","fetch"].includes(req.resourceType()))return;
        const url=resp.url(); const status=resp.status();
        let contentType=""; try{contentType=(await resp.allHeaders())["content-type"]||""}catch{}
        let raw=null, data=null, rows=[], score=0, decodeError="";
        try{raw=Buffer.from(await resp.body())}catch(e){decodeError="body:"+e.message}
        if(raw){try{data=decodeAnyBody(raw)}catch(e){decodeError="decode:"+e.message}}
        if(data){try{rows=findMedalRows(data);score=scoreMedalRows(rows)}catch(e){decodeError="rows:"+e.message}}
        debug.push({url,status,resourceType:req.resourceType(),contentType,bytes:raw?.length||0,rows:rows.length,score,decodeError});
        if(rows.length>=3)candidates.push({url,rows,score,method:"browser-xhr"});
      }catch(e){debug.push({url:resp.url(),status:resp.status(),error:e.message})}
    });

    await page.goto(OFFICIAL_SITE,{waitUntil:"domcontentloaded",timeout:60000});
    await page.waitForTimeout(2500); collecting=true;

    // Prefer real medal links present in the DOM instead of guessing routes.
    try{
      const links=await page.locator('a').evaluateAll(els=>els.map(a=>({text:(a.textContent||'').trim(),href:a.getAttribute('href')||''})).filter(x=>/medal/i.test(x.text+' '+x.href)));
      debug.push({domMedalLinks:links});
      if(links.length){
        const href=links[0].href;
        if(href){await page.goto(new URL(href,OFFICIAL_SITE).toString(),{waitUntil:"domcontentloaded",timeout:60000});clicked=true;await page.waitForTimeout(6000)}
      }
    }catch(e){debug.push({domLinkError:e.message})}

    if(!clicked){
      for(const selector of [()=>page.getByText(/Medals/i,{exact:true}).first(),()=>page.getByRole("link",{name:/Medals/i}).first(),()=>page.getByRole("button",{name:/Medals/i}).first()]){
        try{const el=selector();await el.click({timeout:5000});clicked=true;await page.waitForTimeout(6000);break}catch{}
      }
    }

    if(!candidates.length){
      for(const route of ["#/medals","#/medals/table","#/medal","#/medal-table","#/medals/standings","/medals","/medals/table"]){
        try{await page.goto(new URL(route,OFFICIAL_SITE).toString(),{waitUntil:"domcontentloaded",timeout:45000});await page.waitForTimeout(4500)}catch(e){debug.push({route,error:e.message})}
      }
    }

    try{
      const texts=[...(await page.locator("tr").allTextContents()),...(await page.locator('[role="row"]').allTextContents())];
      const rows=parseDomMedalRows(texts);
      debug.push({domRowsSample:texts.slice(0,20),domParsedRows:rows.length,currentUrl:page.url()});
      if(rows.length>=3)candidates.push({url:page.url()+"#dom",rows,score:999,method:"browser-dom"});
    }catch(e){debug.push({domParseError:e.message})}
  }catch(e){fatalError=e.stack||e.message}
  finally{
    try{fs.writeFileSync(path.join(ROOT,"medal-discovery-debug.json"),JSON.stringify({generatedAt:new Date().toISOString(),clicked,fatalError,candidates:candidates.map(c=>({url:c.url,rows:c.rows.length,score:c.score,method:c.method})),responses:debug},null,2),"utf8")}catch{}
    if(browser)await browser.close().catch(()=>{});
  }
  if(candidates.length){candidates.sort((a,b)=>(b.score||0)-(a.score||0)||b.rows.length-a.rows.length);const best=candidates[0];discoveredMedalEndpoint=best.url;return{rows:best.rows,url:best.url,method:best.method||"browser-discovery"};}
  return null;
}

async function hydrateMissingDailyMedals(raw){
  // Re-query every finished VIE event once. We only assign a medal when the detailed
  // result explicitly marks the unit as a medal event, avoiding false medals from heats.
  for(const e of raw.events||[]){
    if(e.status!=="finished"||!(e.vietnam||[]).length)continue;
    try{
      const result=(await bornanGet(`${OFFICIAL_BASE}/${encodeURIComponent(e.disc)}/results/${encodeURIComponent(e.resCode)}`)).data;
      const info=result?.Info||{};
      const isMedal=String(info?.Medal??"")!=="0"&&String(info?.Medal??"")!=="";
      const detailed=normalizeVieResult(result);
      if(detailed.length)e.vietnam=detailed;
      e.medalEvent=isMedal||e.medalEvent;
      if(!e.medalEvent)continue;
      for(const v of e.vietnam||[]){
        if(v.medal)continue;
        const r=Number(v.rank);
        if(r===1)v.medal="ME_GOLD"; else if(r===2)v.medal="ME_SILVER"; else if(r===3)v.medal="ME_BRONZE";
      }
    }catch{}
  }
  return raw;
}
async function getMedalTable(date){
  const key="medal-table"; const hit=cache.get(key); if(hit&&Date.now()-hit.ts<MEDAL_CACHE_MS)return hit.value;
  let official=null; try{official=await tryDirectMedalEndpoints();}catch{}
  if(!official){try{official=await discoverMedalsWithBrowser();}catch{}}
  if(official){
    const vie=official.rows.find(r=>r.isVietnam)||null;
    const value={official:true,label:"Bảng tổng sắp huy chương chính thức",updatedAt:new Date().toISOString(),source:official.url,method:official.method,rows:official.rows,vietnam:vie};
    cache.set(key,{ts:Date.now(),value}); writeSnapshot("medals.json",value); return value;
  }
  const raw=await hydrateMissingDailyMedals(await collectVietnam(date)); const d=dailyMedalSummary(raw);
  const fallback={rank:"—",country:"🇻🇳 Việt Nam (trong ngày)",org:"VIE",gold:d.gold,silver:d.silver,bronze:d.bronze,total:d.total,isVietnam:true};
  return {official:false,label:"Chưa bắt được Medal Table tổng • đang hiển thị huy chương Việt Nam phát hiện trong ngày",updatedAt:new Date().toISOString(),source:"Bornan results/{ResCode}",method:"daily-fallback-v2.0",rows:[fallback],vietnam:fallback};
}

function sendJSON(res,status,obj){const body=JSON.stringify(obj,null,2);res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","access-control-allow-origin":"*"});res.end(body);}
function serveStatic(req,res){let pathname=new URL(req.url,`http://${req.headers.host}`).pathname;if(pathname==="/")pathname="/index.html";const safe=path.normalize(pathname).replace(/^(\.\.[/\\])+/ ,"");const p=path.join(ROOT,safe);if(!p.startsWith(ROOT)||!fs.existsSync(p)||!fs.statSync(p).isFile())return false;const ext=path.extname(p).toLowerCase();const map={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8"};res.writeHead(200,{"content-type":map[ext]||"application/octet-stream"});fs.createReadStream(p).pipe(res);return true;}

const server=http.createServer(async(req,res)=>{const u=new URL(req.url,`http://${req.headers.host}`);
  if(u.pathname==="/api/data"){
    const date=u.searchParams.get("date")||japanDateISO();
    try{return sendJSON(res,200,buildAppData(await collectVietnam(date)));}
    catch(e){const stale=readSnapshot(`vietnam-${date}.json`);if(stale){const d=buildAppData(stale);d.meta.label="Dữ liệu Bornan chính thức • bản lưu gần nhất";d.meta.sourceMode="official-stale";d.meta.error=e.message;return sendJSON(res,200,d)}return sendJSON(res,500,{error:e.message});}
  }
  if(u.pathname==="/api/medals"){
    const date=u.searchParams.get("date")||japanDateISO();
    try{return sendJSON(res,200,await getMedalTable(date));}
    catch(e){const stale=readSnapshot("medals.json");if(stale)return sendJSON(res,200,{...stale,stale:true,label:"Bảng tổng sắp huy chương chính thức • bản lưu gần nhất",error:e.message});return sendJSON(res,500,{error:e.message});}
  }
  if(u.pathname==="/api/medal-raw"){try{const x=await fetchKnownMedalPayload();return sendJSON(res,200,{endpoint:x.url,rowsDetected:x.rows.length,data:x.data});}catch(e){return sendJSON(res,500,{error:e.message});}}
  if(u.pathname==="/api/medal-shape"){try{const x=await fetchKnownMedalPayload();return sendJSON(res,200,{endpoint:x.url,rowsDetected:x.rows.length,shape:summarizeShape(x.data)});}catch(e){return sendJSON(res,500,{error:e.message});}}
  if(u.pathname==="/api/medal-debug"){try{const f=path.join(ROOT,"medal-discovery-debug.json");return sendJSON(res,200,fs.existsSync(f)?JSON.parse(fs.readFileSync(f,"utf8")):{generated:false,message:"Chưa có log. Hãy mở /api/medals trước."});}catch(e){return sendJSON(res,500,{error:e.message});}}
  if(u.pathname==="/api/vietnam-today"){
    const date=u.searchParams.get("date")||japanDateISO();
    try{return sendJSON(res,200,await collectVietnam(date));}
    catch(e){const stale=readSnapshot(`vietnam-${date}.json`);if(stale)return sendJSON(res,200,{...stale,stale:true,error:e.message});return sendJSON(res,500,{official:false,error:e.message});}
  }
  if(u.pathname==="/api/health")return sendJSON(res,200,{ok:true,version:"2.1.0",medalEndpoint:discoveredMedalEndpoint||`${OFFICIAL_BASE}/ALL/medals/standings`,cacheSeconds:CACHE_MS/1000,now:new Date().toISOString()});
  if(serveStatic(req,res))return;res.writeHead(404,{"content-type":"text/plain; charset=utf-8"});res.end("Not found");
});
server.listen(PORT,()=>{console.log(`ASIAD20 V2.1 Online running at http://localhost:${PORT}`);console.log(`Vietnam API: http://localhost:${PORT}/api/vietnam-today`);console.log(`Medal API: http://localhost:${PORT}/api/medals`);});
