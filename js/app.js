/* Fishy Friends main app. Runs entirely in the browser.
   Live data: Open-Meteo (weather, sea temperature, place search). Tides, sun and moon are calculated here.
   Shared pins and comments: Supabase (optional, see js/config.js). */
"use strict";
const TZ = "Australia/Sydney";
const HOUR = 3600000;
const SPECIES = window.SPECIES, SPECIES_KEYS = Object.keys(SPECIES);
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

/* ---------- time ---------- */
const partsFmt = new Intl.DateTimeFormat("en-AU", {timeZone:TZ,year:"numeric",month:"numeric",day:"numeric",hour:"numeric",minute:"numeric",hourCycle:"h23",weekday:"short"});
function P(d){const o={};for(const p of partsFmt.formatToParts(d))o[p.type]=p.value;return{y:+o.year,m:+o.month,d:+o.day,h:+o.hour,min:+o.minute,wd:o.weekday}}
const fTime = new Intl.DateTimeFormat("en-AU",{timeZone:TZ,hour:"numeric",minute:"2-digit"});
const fDay = new Intl.DateTimeFormat("en-AU",{timeZone:TZ,weekday:"short",day:"numeric",month:"short"});
const fDayLong = new Intl.DateTimeFormat("en-AU",{timeZone:TZ,weekday:"long",day:"numeric",month:"long"});
const t12 = d => fTime.format(d).replace(/\s?(am|pm)/i,(m,x)=>" "+x.toLowerCase());
const WD = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const dayKey = d => { const p=P(d); return p.y+"-"+p.m+"-"+p.d; };
let NOW = new Date(), START, END;
const DAYS = 8;
function setClock(){
  NOW = new Date(); const np = P(NOW);
  START = new Date(Math.floor((NOW.getTime()-(np.h*60+np.min)*60000)/60000)*60000); START.setSeconds(0,0);
  END = new Date(START.getTime()+DAYS*24*HOUR);
}
setClock();
const dayStart = i => new Date(START.getTime()+i*24*HOUR);
function dayLabel(t){const k=dayKey(new Date(t));if(k===dayKey(NOW))return"Today";if(k===dayKey(new Date(NOW.getTime()+24*HOUR)))return"Tomorrow";return fDay.format(new Date(t))}

/* ---------- store (this phone) ---------- */
const SLOTS=[["dawn","Dawn"],["morning","Morning"],["arvo","Arvo"],["evening","Evening"],["night","Night"]];
const COLORS=["#13707A","#B9752A","#7A5BB0","#2D8A57","#C2476B","#3A6FB0"];
function defaultFree(){const f={};WD.forEach((d,i)=>{f[d]=i>=5?["dawn","morning","arvo"]:["evening"]});return f}
const EXAMPLE={id:"example",name:"You",color:COLORS[0],free:defaultFree(),spotTypes:["jetty","seawall"],targets:["bream","flathead","leatherjacket"],method:"bait",tone:"calm",example:true};
let STORE = ls.get("ff.v1", null) || ls.get("bitetime.v1", null) || {};
STORE.people = Array.isArray(STORE.people) && STORE.people.length ? STORE.people : [EXAMPLE];
STORE.active = Array.isArray(STORE.active) && STORE.active.length ? STORE.active : [STORE.people[0].id];
STORE.mySpots = Array.isArray(STORE.mySpots) ? STORE.mySpots : ["mortbay","clifton"];
STORE.places = STORE.places || {};
STORE.people.forEach(p=>{if(!p.tone)p.tone="calm"});
const save = () => ls.set("ff.v1", STORE);
function activePeople(){const a=STORE.people.filter(p=>STORE.active.includes(p.id));return a.length?a:[STORE.people[0]]}
const fishy = () => activePeople().some(p=>p.tone==="fishy");
const T = (calm, kid) => fishy() ? kid : calm;

/* ---------- spots ---------- */
const SPOTS = Object.assign({}, window.CURATED_SPOTS);
Object.entries(STORE.places).forEach(([k,v])=>{ if(!SPOTS[k]) SPOTS[k]=v; });
STORE.mySpots = STORE.mySpots.filter(k=>SPOTS[k]);
const mySpots = () => STORE.mySpots.length ? STORE.mySpots : ["mortbay","clifton"];
const TYPE_SUIT = {
  jetty:{squid:.9,kingfish:.8,leatherjacket:.95,bream:.9,trevally:.9,flathead:.7,whiting:.6,tailor:.7,snapper:.7,luderick:.6,mullet:.8},
  rocks:{luderick:.95,bream:.95,tailor:.85,leatherjacket:.85,snapper:.8,kingfish:.75,squid:.8,trevally:.8,flathead:.5,whiting:.3,mullet:.6},
  beach:{whiting:1,flathead:1,bream:.8,tailor:.75,trevally:.6,mullet:.7,squid:.4,snapper:.5,leatherjacket:.4,luderick:.4,kingfish:.4},
  seawall:{bream:.95,mullet:.95,leatherjacket:.85,luderick:.8,flathead:.75,trevally:.8,squid:.6,whiting:.5,tailor:.6,snapper:.55,kingfish:.45},
  park:{bream:.9,mullet:.9,flathead:.75,leatherjacket:.8,luderick:.75,trevally:.75,whiting:.5,tailor:.6,squid:.55,snapper:.5,kingfish:.45}
};
function suit(spot, sp){
  const s=SPOTS[spot]; if(s.suit && s.suit[sp]!=null) return s.suit[sp];
  let best=0; (s.type||[]).forEach(t=>{best=Math.max(best,(TYPE_SUIT[t]||{})[sp]||0)});
  return best||.6;
}
function inPortJackson(lat,lon){return lat>-33.88&&lat<-33.76&&lon>151.0&&lon<151.30}
const BRIDGE_LON=151.2108;
function safetyFor(lat,lon){return inPortJackson(lat,lon)?(lon<BRIDGE_LON?"west":"east"):"none"}
function distKm(a,b,c,d){const R=6371,r=Math.PI/180,x=(d-b)*r*Math.cos((a+c)/2*r),y=(c-a)*r;return Math.sqrt(x*x+y*y)*R}
function stationFor(spot){
  const s=SPOTS[spot]; if(s.station) return s.station;
  if(inPortJackson(s.lat,s.lon)) return s.station="fd";
  let best=null,bd=1e9; for(const [k,st] of Object.entries(window.STATIONS)){const d=distKm(s.lat,s.lon,st.lat,st.lon);if(d<bd){bd=d;best=k}}
  return s.station = bd<120 ? best : null;
}
function wxKey(spot){const s=SPOTS[spot];if(s.safety==="west")return"zone-west";if(s.safety==="east")return"zone-east";return spot}
const WX_POINTS={"zone-west":[-33.8549,151.1802],"zone-east":[-33.8392,151.2534]};

/* ---------- tides ---------- */
const TIDES={};
function tides(spot){
  const st=stationFor(spot); if(!st) return {line:[],ext:[],none:true};
  if(!TIDES[st]){
    const S=window.STATIONS[st];
    try{
      const station=Neaps.useStation({id:S.id,name:S.name,chart_datum:"LAT",datums:S.datums,harmonic_constituents:S.hc.map(([n,a,p])=>({name:n,amplitude:a,phase:p}))});
      const a=new Date(START.getTime()-14*HOUR),b=new Date(END.getTime()+14*HOUR);
      TIDES[st]={name:S.name,
        line:station.getTimelinePrediction({start:a,end:b,timeFidelity:600}).timeline.map(x=>({t:x.time.getTime(),v:x.level+(S.fix||0)})),
        ext:station.getExtremesPrediction({start:a,end:b}).extremes.map(x=>({t:x.time.getTime(),v:x.level+(S.fix||0),high:x.high}))};
    }catch(e){console.error(e);TIDES[st]={line:[],ext:[],none:true}}
  }
  return TIDES[st];
}
function tideStage(t,spot){
  const ext=tides(spot).ext;let prev=null,next=null;
  for(const e of ext){if(e.t<=t)prev=e;else{next=e;break}}
  if(!prev||!next)return null;
  const range=Math.abs(next.v-prev.v);
  if(Math.min(t-prev.t,next.t-t)<40*60000)return{stage:"slack",flow:0,range,near:(t-prev.t<next.t-t)?prev:next};
  return{stage:next.high?"in":"out",flow:Math.sin(Math.PI*(t-prev.t)/(next.t-prev.t)),range};
}

/* ---------- sun & moon ---------- */
const sunCache={};
function sunFor(t,spot){const d=new Date(t),k=dayKey(d)+spot;if(!sunCache[k]){const p=P(d);const mid=new Date(d.getTime()-(p.h*60+p.min)*60000+12*HOUR);const s=SPOTS[spot];const x=SunCalc.getTimes(mid,s.lat,s.lon);sunCache[k]={rise:x.sunrise.getTime(),set:x.sunset.getTime()}}return sunCache[k]}
function lightAt(t,spot){const s=sunFor(t,spot);
  if(t>=s.rise-60*60000&&t<=s.rise+120*60000)return"dawn";
  if(t>=s.set-120*60000&&t<=s.set+60*60000)return"dusk";
  return t>s.rise&&t<s.set?"day":"night"}
const moonAt=t=>SunCalc.getMoonIllumination(new Date(t));
function moonName(p){if(p<.03||p>.97)return"New moon";if(p<.22)return"Waxing crescent";if(p<.28)return"First quarter";if(p<.47)return"Waxing gibbous";if(p<.53)return"Full moon";if(p<.72)return"Waning gibbous";if(p<.78)return"Last quarter";return"Waning crescent"}
function moonScore(p){const d=Math.min(Math.abs(p),Math.abs(p-1),Math.abs(p-.5));return 1-Math.min(1,d*4)*.7}

/* ---------- live weather (Open-Meteo), cached 30 min ---------- */
const WX={},WX_PENDING={};
function loadWeather(key){
  if(WX[key]||WX_PENDING[key])return WX_PENDING[key]||Promise.resolve(WX[key]);
  const cached=ls.get("ff.wx."+key,null);
  if(cached&&Date.now()-cached.at<30*60000){WX[key]=cached;return Promise.resolve(cached)}
  const [lat,lon]=WX_POINTS[key]||[SPOTS[key].lat,SPOTS[key].lon];
  const f=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timeformat=unixtime&forecast_days=8&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m`;
  const m=`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&timeformat=unixtime&forecast_days=8&hourly=sea_surface_temperature`;
  WX_PENDING[key]=Promise.all([fetch(f).then(r=>r.ok?r.json():null).catch(()=>null),fetch(m).then(r=>r.ok?r.json():null).catch(()=>null)])
    .then(([a,b])=>{
      const o={at:Date.now(),w:a&&a.hourly||null,sea:b&&b.hourly&&b.hourly.sea_surface_temperature&&b.hourly.sea_surface_temperature.some(v=>v!=null)?b.hourly:null};
      if(o.w||o.sea){WX[key]=o;ls.set("ff.wx."+key,o)}else if(cached){WX[key]=cached}
      delete WX_PENDING[key];return WX[key];
    });
  return WX_PENDING[key];
}
function nearestIdx(arr,t){if(!arr||!arr.length)return -1;let lo=0,hi=arr.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(arr[m]*1000<=t)lo=m;else hi=m}const i=Math.abs(arr[lo]*1000-t)<=Math.abs(arr[hi]*1000-t)?lo:hi;return Math.abs(arr[i]*1000-t)<=90*60000?i:-1}
function wxAt(spot,t){const o=WX[wxKey(spot)];if(!o||!o.w)return null;const w=o.w,i=nearestIdx(w.time,t);if(i<0)return null;
  return{temp:w.temperature_2m[i],wind:w.wind_speed_10m[i],gust:w.wind_gusts_10m?w.wind_gusts_10m[i]:null,dir:w.wind_direction_10m[i],rain:w.precipitation_probability?w.precipitation_probability[i]:null,code:w.weather_code?w.weather_code[i]:null}}
function seaAt(spot,t){const o=WX[wxKey(spot)];if(!o||!o.sea)return null;const i=nearestIdx(o.sea.time,t);return i<0?null:o.sea.sea_surface_temperature[i]}
const DIRS=["N","NE","E","SE","S","SW","W","NW"];
const compass=d=>DIRS[Math.round(((d%360)+360)%360/45)%8];
function inArc(d,a){if(!a)return false;const[x,y]=a;return x<=y?(d>=x&&d<=y):(d>=x||d<=y)}
function wxWord(c){if(c==null)return"";if(c===0)return"Clear";if(c<=2)return"Partly cloudy";if(c===3)return"Cloudy";if(c<=48)return"Fog";if(c<=57)return"Drizzle";if(c<=67)return"Rain";if(c<=77)return"Cold showers";if(c<=82)return"Showers";return"Storms"}

/* ---------- scoring ---------- */
function score(spot,sp,t){
  const S=SPECIES[sp],spotD=SPOTS[spot],parts=[],B=[],R=[];
  const ts=tideStage(t,spot);
  if(ts){let tide=S.tide[ts.stage];if(ts.stage!=="slack")tide*=(.6+.4*ts.flow);tide*=.85+.15*Math.min(1,ts.range/1.6);
    parts.push([.30,tide]);
    B.push({k:"Tide",w:.30,s:tide,n:(ts.stage==="slack"?"Slack water (little movement). ":ts.stage==="in"?"Tide rising (run-in). ":"Tide falling (run-out). ")+S.name+" rate this stage "+Math.round(S.tide[ts.stage]*100)+"/100"+(ts.stage!=="slack"?"; stronger mid-tide flow scores higher.":".")});
    R.push(ts.stage==="in"?"Run-in tide":ts.stage==="out"?"Run-out tide":(ts.near&&ts.near.high?"High-tide slack":"Low-tide slack"));}
  const L=lightAt(t,spot);parts.push([.25,S.light[L]]);
  B.push({k:"Light",w:.25,s:S.light[L],n:{dawn:"Dawn (1 hour before to 2 hours after sunrise).",dusk:"Dusk (2 hours before to 1 hour after sunset).",day:"Daytime.",night:"Night."}[L]+" Most fish feed hardest in low light."});
  R.push(L==="dawn"?"Dawn light":L==="dusk"?"Dusk light":L==="day"?"Daylight":"Night");
  const m=moonAt(t);parts.push([.10,moonScore(m.phase)]);
  B.push({k:"Moon",w:.10,s:moonScore(m.phase),n:moonName(m.phase)+". New and full moons bring bigger tides and often better bites."});
  const ph=moonName(m.phase);if(ph==="New moon"||ph==="Full moon")R.push("Near "+ph.toLowerCase());
  const w=wxAt(spot,t);
  if(w){const eff=w.wind*(inArc(w.dir,spotD.exposed)?1.3:.85)/S.windTol;
    const ws=eff<10?1:eff<20?1-(eff-10)/10*.4:eff<30?.6-(eff-20)/10*.4:.15;
    const rs=w.rain==null?1:1-(w.rain/100)*.7*S.rain;
    parts.push([.20,ws*.7+rs*.3]);
    B.push({k:"Wind and rain",w:.20,s:ws*.7+rs*.3,n:Math.round(w.wind)+" km/h from the "+compass(w.dir)+(inArc(w.dir,spotD.exposed)?" (blowing straight in here)":"")+(w.rain!=null?", "+w.rain+"% chance of rain":"")+". Light wind and dry weather score best."});
    R.push((w.wind<12?"Light ":w.wind<25?"Moderate ":"Strong ")+compass(w.dir)+" wind "+Math.round(w.wind)+" km/h");}
  const sst=seaAt(spot,t);
  if(sst!=null){const[lo,hi]=S.temp;const tsc=sst>=lo&&sst<=hi?1:Math.max(.2,1-.15*(sst<lo?lo-sst:sst-hi));parts.push([.15,tsc]);
    B.push({k:"Water temperature",w:.15,s:tsc,n:sst.toFixed(1)+"°C. "+S.name+" like "+lo+"–"+hi+"°C."});
    if(tsc>.9)R.push("Water "+sst.toFixed(0)+"°C suits them");}
  let sw=0,sv=0;for(const[a,b]of parts){sw+=a;sv+=a*b}
  const mon=P(new Date(t)).m-1,seasonF=.55+.45*S.season[mon],suitF=suit(spot,sp);
  const total=(sv/sw)*seasonF*suitF;
  return{v:Math.round(Math.max(0,Math.min(1,total))*100),reasons:R,light:L,B,base:sv/sw,seasonF,suitF,mon};
}
const band=v=>v>=70?"good":v>=55?"fair":"poor";
const bandWord=v=>fishy()?(v>=70?"Strong":v>=55?"OK":"Sleepy"):(v>=70?"Good":v>=55?"Fair":"Slow");

/* ---------- free time and targets ---------- */
function slotOf(t,spot){const L=lightAt(t,spot),h=P(new Date(t)).h;return{L,clock:h>=21||h<5?"night":h<11?"morning":h<17?"arvo":"evening"}}
function isFree(t,spot){const d=WD[(new Date(t).getDay()+6)%7];const wd=P(new Date(t)).wd;const key=WD.includes(wd)?wd:d;const{L,clock}=slotOf(t,spot);
  return activePeople().every(p=>{const f=(p.free&&p.free[key])||[];return(L==="dawn"&&f.includes("dawn"))||f.includes(clock)})}
function targets(){const s=new Set();activePeople().forEach(p=>(p.targets||[]).forEach(x=>SPECIES[x]&&s.add(x)));return s.size?[...s]:["bream","flathead","leatherjacket"]}
function typeMatch(spot){const want=new Set();activePeople().forEach(p=>(p.spotTypes||[]).forEach(x=>want.add(x)));return(SPOTS[spot].type||[]).filter(x=>want.has(x))}

/* ---------- windows ---------- */
function hourList(a,b){const o=[];for(let t=Math.ceil(a/HOUR)*HOUR;t<b;t+=HOUR)o.push(t);return o}
function bestAt(spot,t,list){let best=null;for(const sp of list){const s=score(spot,sp,t);if(!best||s.v>best.v)best={...s,sp}}return best}
function windowsFor(spot,a,b,list,needFree=true){
  const hrs=hourList(a,b).map(t=>({t,free:isFree(t,spot),b:bestAt(spot,t,list)}));
  const ok0=h=>(!needFree||h.free)&&(h.b.light!=="night"||h.b.sp==="squid");
  const cand=hrs.filter(ok0);if(!cand.length)return null;
  const peak=cand.reduce((x,y)=>y.b.v>x.b.v?y:x);const idx=hrs.indexOf(peak);let s=idx,e=idx;
  const ok=h=>h&&ok0(h)&&h.b.sp===peak.b.sp&&h.b.v>=peak.b.v-7;
  while(e-s<3){const l=hrs[s-1],r=hrs[e+1];const lo=ok(l)?l.b.v:-1,ro=ok(r)?r.b.v:-1;if(lo<0&&ro<0)break;if(ro>=lo)e++;else s--}
  return{spot,sp:peak.b.sp,start:hrs[s].t,end:hrs[e].t+HOUR,v:peak.b.v,reasons:peak.b.reasons,peak:peak.t};
}
function dayWindow(i,spot,list=targets(),needFree=true){const a=Math.max(dayStart(i).getTime(),i===0?NOW.getTime()-30*60000:0),b=dayStart(i+1).getTime();return windowsFor(spot,a,b,list,needFree)}
const rangeTxt=w=>t12(new Date(w.start))+" – "+t12(new Date(w.end));

/* ---------- shared pins & comments (Supabase) ---------- */
const CFG=window.FF_CONFIG||{};
let SB=null,MY_ID=null;
if(CFG.SUPABASE_URL&&CFG.SUPABASE_ANON_KEY&&window.supabase){try{SB=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY,{auth:{persistSession:true,storageKey:"ff.auth"}})}catch(e){console.error(e)}}
async function ensureUser(){
  if(!SB)throw new Error("offline");
  if(MY_ID)return MY_ID;
  const{data}=await SB.auth.getSession();
  if(data&&data.session){MY_ID=data.session.user.id;return MY_ID}
  const r=await SB.auth.signInAnonymously();if(r.error)throw r.error;MY_ID=r.data.user.id;return MY_ID;
}
if(SB){SB.auth.getSession().then(({data})=>{if(data&&data.session)MY_ID=data.session.user.id})}
const SHARED={pins:{},comments:{}};let channel=null,channelSpot=null;
async function loadShared(spot){
  if(!SB)return;
  const [p,c]=await Promise.all([
    SB.from("pins").select("*").eq("spot",spot).order("created_at",{ascending:true}).limit(200),
    SB.from("comments").select("*").eq("spot",spot).order("created_at",{ascending:false}).limit(50)]);
  SHARED.pins[spot]=p.data||[];SHARED.comments[spot]=c.data||[];
  if(channelSpot!==spot){
    if(channel)SB.removeChannel(channel);
    channelSpot=spot;
    channel=SB.channel("spot-"+spot)
      .on("postgres_changes",{event:"*",schema:"public",table:"pins",filter:"spot=eq."+spot},()=>loadShared(spot).then(refreshDetail))
      .on("postgres_changes",{event:"*",schema:"public",table:"comments",filter:"spot=eq."+spot},()=>loadShared(spot).then(refreshDetail))
      .subscribe();
  }
}
function authorName(){const p=activePeople()[0];return p&&!p.example?p.name:"A friend"}

/* ---------- rendering helpers ---------- */
let selSpot=null,selDay=0,detail=null,addingPin=null,editing=null,confirmDel=null,searchState={q:"",results:null,busy:false,err:"",wide:false};
function pill(v,w){const txt=bandWord(v)+" · "+v;if(!w)return`<span class="pill ${band(v)}">${txt}</span>`;
  return`<button type="button" class="pill ${band(v)}" data-why="${w.spot}|${w.sp}|${w.peak}" aria-label="${txt}. Show how this score was worked out">${txt}</button>`}
function safetyBadge(spot){const s=window.SAFETY[SPOTS[spot].safety||"none"];if(!s)return"";return`<span class="badge ${SPOTS[spot].safety==="west"?"release":"keep"}">${s.badge}</span>`}
const mapsLink=(lat,lon)=>`https://www.google.com/maps/search/?api=1&query=${lat.toFixed(5)},${lon.toFixed(5)}`;

function renderWho(){
  $("#who").innerHTML=STORE.people.map(p=>`<button class="chip" aria-pressed="${STORE.active.includes(p.id)}" data-who="${esc(p.id)}"><span class="dot" style="background:${esc(p.color)}"></span>${esc(p.name)}</button>`).join("");
  $("#who").querySelectorAll("[data-who]").forEach(b=>b.onclick=()=>{const id=b.dataset.who;const a=new Set(STORE.active);a.has(id)?a.delete(id):a.add(id);if(!a.size)a.add(id);STORE.active=[...a];save();render()});
}

function heroHTML(){
  let pick=null,firstGood=null;
  for(let i=0;i<7;i++)for(const sp of mySpots()){const w=dayWindow(i,sp);if(!w||w.end<NOW.getTime())continue;if(!pick||w.v>pick.v)pick=w;if(w.v>=70&&(!firstGood||w.start<firstGood.start))firstGood=w}
  const w=firstGood||pick,ex=activePeople().some(p=>p.example);
  if(!w)return`<section class="hero"><p class="label">${T("Next best window","Next quest")}</p><p>${T("No free time set in the next week. Add your free time on the Me tab.","No adventure time set! Add your free time on the Me tab.")}</p></section>`;
  const S=SPECIES[w.sp],sp=SPOTS[w.spot];
  const head=firstGood?T("Next good window","Quest unlocked!"):T("Best window this week","Best quest this week");
  return`<section class="hero" aria-live="polite">
    <div class="hero-head"><span class="label" style="${fishy()?"color:#1A1D3A":""}">${head}</span>${pill(w.v,w)}</div>
    ${fishy()?`<div class="when">${esc(S.name)} are hungry at ${esc(sp.name)}</div><div class="where num"><b>${dayLabel(w.start)}, ${rangeTxt(w)}</b></div>`
      :`<div class="when num">${dayLabel(w.start)}, ${rangeTxt(w)}</div><div class="where"><b>${esc(S.name)}</b> at ${esc(sp.name)}</div>`}
    <div class="reasons">${w.reasons.map(r=>`<span class="tag">${esc(r)}</span>`).join("")}${sp.safety==="west"?`<span class="tag">${T("Catch and release here","Splash it back here")}</span>`:""}</div>
    ${ex?`<p class="example">${T("Example free time. Set yours on the Me tab.","Make your own character on the Me tab!")}</p>`:""}
  </section>`;
}

function tideSVG(i,spot){
  const W=360,H=170,pl=8,pr=8,pt=22,pb=30,d0=dayStart(i).getTime(),a=d0+4*HOUR,b=d0+22*HOUR;
  const x=t=>pl+(t-a)/(b-a)*(W-pl-pr),TD=tides(spot);
  const pts=TD.line.filter(p=>p.t>=a&&p.t<=b);
  const vmax=Math.max(2.2,...pts.map(p=>p.v+.1)),vmin=Math.min(-.1,...pts.map(p=>p.v-.1));
  const y=v=>pt+(1-(v-vmin)/(vmax-vmin))*(H-pt-pb);
  let g="";const list=targets();
  for(let t=a;t<b;t+=HOUR){const best=bestAt(spot,t+30*60000,list);const free=isFree(t+30*60000,spot);
    const col=best.v>=70?"var(--good)":best.v>=55?"var(--fair)":"var(--poor)";
    g+=`<rect x="${x(t)+.5}" y="${pt}" width="${x(t+HOUR)-x(t)-1}" height="${H-pt-pb}" fill="${col}" opacity="${free?.28:.08}"/>`}
  const sun=sunFor(d0+12*HOUR,spot);
  [[sun.rise,"Sunrise"],[sun.set,"Sunset"]].forEach(([t,l])=>{if(t>a&&t<b)g+=`<line x1="${x(t)}" x2="${x(t)}" y1="${pt}" y2="${H-pb}" stroke="var(--sand)" stroke-width="1.5" stroke-dasharray="3 3"/><text x="${x(t)}" y="${pt-8}" text-anchor="middle" style="fill:var(--sand);font-weight:700">${l} ${t12(new Date(t))}</text>`});
  if(pts.length){const path=pts.map((p,k)=>(k?"L":"M")+x(p.t).toFixed(1)+" "+y(p.v).toFixed(1)).join(" ");
    g+=`<path d="${path} L${x(b)} ${H-pb} L${x(a)} ${H-pb} Z" fill="var(--curve)" opacity=".12"/><path d="${path}" fill="none" stroke="var(--curve)" stroke-width="2.5" stroke-linejoin="round"/>`}
  TD.ext.filter(e=>e.t>=a&&e.t<=b).forEach(e=>{const cx=x(e.t),cy=y(e.v),ty=e.high?cy-8:cy+16,an=cx<40?"start":cx>W-40?"end":"middle";
    g+=`<circle cx="${cx}" cy="${cy}" r="3.5" fill="var(--curve)"/><text x="${cx}" y="${ty}" text-anchor="${an}" class="hl">${e.high?"High":"Low"} ${t12(new Date(e.t))}</text>`});
  if(NOW.getTime()>a&&NOW.getTime()<b){const nx=x(NOW.getTime());g+=`<line x1="${nx}" x2="${nx}" y1="${pt}" y2="${H-pb}" stroke="var(--ink)" stroke-width="1.5"/><text x="${nx}" y="${H-pb+24}" text-anchor="middle" class="hl">Now</text>`}
  for(let h=6;h<=21;h+=3){const t=d0+h*HOUR;g+=`<text x="${x(t)}" y="${H-pb+12}" text-anchor="middle">${h===12?"12pm":h<12?h+"am":(h-12)+"pm"}</text>`}
  if(TD.none)g+=`<text x="${W/2}" y="${H/2}" text-anchor="middle" class="hl">No tide gauge near this spot</text>`;
  return`<svg class="tide" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tide and bite chart for ${esc(SPOTS[spot].name)}, ${fDayLong.format(new Date(d0+12*HOUR))}">${g}</svg>`;
}

function condHTML(i,spot){
  const d0=dayStart(i).getTime(),ref=i===0?NOW.getTime():d0+7*HOUR,TD=tides(spot);
  const nx=TD.ext.filter(e=>e.t>ref).slice(0,2),sun=sunFor(d0+12*HOUR,spot),m=moonAt(d0+20*HOUR),sst=seaAt(spot,ref),w=wxAt(spot,ref);
  const loading=!WX[wxKey(spot)];
  const wait=loading?"Loading…":"Not available";
  return`<div class="cond">
    <div><span class="label">Tides${i===0?" next":" from 7am"}</span><span class="v num">${nx.length?nx.map(e=>(e.high?"High ":"Low ")+t12(new Date(e.t))).join("<br>"):"No gauge nearby"}</span><span class="small muted num">${nx.map(e=>e.v.toFixed(2)+" m").join(" · ")}</span></div>
    <div><span class="label">Sun</span><span class="v num">Up ${t12(new Date(sun.rise))}<br>Down ${t12(new Date(sun.set))}</span></div>
    <div><span class="label">Moon</span><span class="v">${moonName(m.phase)}</span><span class="small muted num">${Math.round(m.fraction*100)}% lit</span></div>
    <div><span class="label">Water</span><span class="v num">${sst!=null?sst.toFixed(1)+"°C":wait}</span><span class="small muted">Sea surface</span></div>
    <div><span class="label">Wind${i===0?" now":" at 7am"}</span>${w?`<span class="v num">${compass(w.dir)} ${Math.round(w.wind)} km/h</span><span class="small muted num">${w.gust!=null?"Gusts "+Math.round(w.gust)+" km/h":""}</span>`:`<span class="v">${wait}</span>`}</div>
    <div><span class="label">Weather</span>${w?`<span class="v num">${Math.round(w.temp)}°C ${wxWord(w.code)}</span><span class="small muted num">${w.rain!=null?w.rain+"% chance of rain":""}</span>`:`<span class="v">${wait}</span>`}</div>
  </div>`;
}

function fishRows(i,spot,list){
  const a=Math.max(dayStart(i).getTime(),i===0?NOW.getTime()-30*60000:0),b=dayStart(i+1).getTime();
  return list.map(sp=>({sp,w:windowsFor(spot,a,b,[sp],true)}));
}
function fishHTML(i,spot){
  const list=targets();
  const rows=fishRows(i,spot,list).sort((x,y)=>(y.w?y.w.v:-1)-(x.w?x.w.v:-1));
  const others=fishRows(i,spot,SPECIES_KEYS.filter(k=>!list.includes(k))).filter(o=>o.w&&o.w.v>=66).sort((x,y)=>y.w.v-x.w.v).slice(0,2);
  const row=o=>`<div class="fish-row"><span class="name">${SPECIES[o.sp].name}</span>${o.w?pill(o.w.v,o.w):`<span class="pill poor">${T("No free time","No free time")}</span>`}
    <span class="num muted">${o.w?"Best "+rangeTxt(o.w)+" · "+o.w.reasons.slice(0,2).join(", ").toLowerCase():"Outside your free time"}</span><span></span>
    <span class="tip">${esc(fishy()?SPECIES[o.sp].fishyTip:SPECIES[o.sp].tip)} <a href="#guide-${guideFor(o.sp)}">${T("How to rig it","Show me how")} ›</a></span></div>`;
  return`<section class="card"><div class="sub"><h2>${T("Your fish here","Your fish to find")}</h2><span class="small muted">${i===0?"Today":fDay.format(dayStart(i))}</span></div><div class="fish">${rows.map(row).join("")}</div></section>`
    +(others.length?`<section class="card"><div class="sub"><h2>${T("Also biting","Bonus fish!")}</h2><span class="small muted">${T("Suggested for you","Try these too")}</span></div><div class="fish">${others.map(row).join("")}</div></section>`:"");
}

/* The tide strip holds all 7 days side by side. Swiping to a day selects it; picking a day scrolls to it. */
function wireTideScroll(el){
  const sc=el.querySelector("#tideScroll");if(!sc)return;
  const chip=el.querySelector("[data-day][aria-pressed=true]"),row=chip&&chip.parentElement;
  const go=()=>{sc.scrollLeft=selDay*sc.clientWidth;
    if(row){const r=row.getBoundingClientRect(),c=chip.getBoundingClientRect();row.scrollLeft+=c.left-r.left-(r.width-c.width)/2}};
  go();requestAnimationFrame(go);
  let timer=null;
  sc.addEventListener("scroll",()=>{clearTimeout(timer);timer=setTimeout(()=>{
    const i=Math.max(0,Math.min(6,Math.round(sc.scrollLeft/sc.clientWidth)));
    if(i!==selDay){selDay=i;refreshKeep()}},140)},{passive:true});
}
function renderToday(){
  const list=mySpots();if(!selSpot||!list.includes(selSpot))selSpot=list[0];const sp=selSpot;
  const dayBtns=[0,1,2,3,4,5,6].map(i=>`<button class="chip" aria-pressed="${i===selDay}" data-day="${i}">${i===0?"Today":i===1?"Tomorrow":fDay.format(dayStart(i))}</button>`).join("");
  const st=window.SAFETY[SPOTS[sp].safety||"none"];
  return heroHTML()+questBoardHTML()+`
  <div class="seg" role="group" aria-label="Spot">${list.map(k=>`<button class="chip" aria-pressed="${k===sp}" data-spot="${k}">${esc(SPOTS[k].name)}</button>`).join("")}<a class="chip" href="#spots" style="text-decoration:none;color:var(--muted)">+ Add</a></div>
  <section class="card">
    <div class="sub"><h2>${esc(SPOTS[sp].name)}</h2>${safetyBadge(sp)}</div>
    ${st?`<p class="small muted">${st.text}</p>`:""}
    <div class="seg" role="group" aria-label="Day">${dayBtns}</div>
    <div class="tide-scroll" id="tideScroll" aria-label="Tide charts for the next 7 days. Swipe sideways to change day.">${[0,1,2,3,4,5,6].map(i=>`<div class="tide-day" data-tday="${i}">${tideSVG(i,sp)}</div>`).join("")}</div>
    <p class="small muted swipe-hint">${T("Swipe the chart sideways for other days","Swipe the waves to see more days")} ›</p>
    <div class="legend"><span><i class="sw" style="background:var(--good);opacity:.5"></i>${bandWord(80)}</span><span><i class="sw" style="background:var(--fair);opacity:.5"></i>${bandWord(60)}</span><span><i class="sw" style="background:var(--poor);opacity:.5"></i>${bandWord(40)}</span><span>Faded = outside free time</span></div>
    ${condHTML(selDay,sp)}
    <div class="row-btns"><button class="btn ghost small" data-detail="${sp}">${T("Map and cast points","Treasure map")}</button></div>
  </section>`+fishHTML(selDay,sp);
}

function renderDays(n){
  let h=`<div class="seg" role="group" aria-label="Range"><a class="chip" href="#next-3-days" aria-pressed="${n===3}" style="text-decoration:none;color:inherit">Next 3 days</a><a class="chip" href="#week" aria-pressed="${n===7}" style="text-decoration:none;color:inherit">7 days</a></div><div class="days">`;
  for(let i=0;i<n;i++){
    const d0=dayStart(i).getTime(),first=mySpots()[0],sun=sunFor(d0+12*HOUR,first),m=moonAt(d0+20*HOUR);
    const ex=tides(first).ext.filter(e=>e.t>=d0&&e.t<d0+24*HOUR),w=wxAt(first,d0+9*HOUR);
    const lines=mySpots().map(sp=>{const win=dayWindow(i,sp);return`<div class="spot-line"><span>${win?`<b class="num">${rangeTxt(win)}</b> · ${SPECIES[win.sp].name}`:`<span class="muted">No free time</span>`}</span>${win?pill(win.v,win):""}<span class="s">${esc(SPOTS[sp].name)}</span></div>`}).join("");
    h+=`<div class="day" role="button" tabindex="0" data-open="${i}"><div class="day-head"><h3>${i===0?"Today":i===1?"Tomorrow":fDayLong.format(new Date(d0+12*HOUR))}</h3><span class="small muted">${moonName(m.phase)}</span></div>${lines}
      <div class="meta num"><span>Tides ${ex.map(e=>(e.high?"H ":"L ")+t12(new Date(e.t))).join(", ")}</span><span>Sun ${t12(new Date(sun.rise))} – ${t12(new Date(sun.set))}</span>${w?`<span>${Math.round(w.temp)}°C, ${compass(w.dir)} ${Math.round(w.wind)} km/h</span>`:""}</div></div>`;
  }
  return h+`</div>`;
}

/* ---------- spots view ---------- */
function spotBest(spot){let best=null;for(let i=0;i<3;i++){const w=dayWindow(i,spot);if(w&&w.end>NOW.getTime()&&(!best||w.v>best.v))best=w}return best}
function spotCard(k,opts={}){
  const s=SPOTS[k],w=spotBest(k),m=typeMatch(k),saved=STORE.mySpots.includes(k);
  return`<div class="card spot-card">
    <div class="spot-head"><div><b style="font-size:1.05rem">${esc(s.name)}</b><div class="small muted">${esc(s.area||"")}${s.type?" · "+s.type.join(", "):""}</div></div>${w?pill(w.v,w):""}</div>
    ${w?`<span class="small num"><b>Best:</b> ${dayLabel(w.start)} ${rangeTxt(w)}, ${SPECIES[w.sp].name.toLowerCase()}</span>`:""}
    ${(s.pros||[]).slice(0,opts.full?9:2).map(p=>`<span class="pro">+ ${esc(p)}</span>`).join("")}
    ${(s.cons||[]).slice(0,opts.full?9:1).map(p=>`<span class="con">– ${esc(p)}</span>`).join("")}
    <div class="badges">${safetyBadge(k)}${m.length?`<span class="badge info">Matches: ${m.join(", ")}</span>`:""}${s.approx?`<span class="badge info">Location approx</span>`:""}</div>
    <div class="row-btns"><button class="btn small" data-detail="${k}">Details</button><button class="btn ghost small" data-save="${k}">${saved?"Saved ✓":"Save spot"}</button></div>
  </div>`;
}
function renderSpots(){
  if(detail)return renderDetail(detail);
  const sug=Object.keys(SPOTS).filter(k=>!STORE.mySpots.includes(k)&&window.CURATED_SPOTS[k])
    .map(k=>{const w=spotBest(k);const keep=activePeople().length&&SPOTS[k].safety==="east"?3:0;return{k,s:(w?w.v:0)+typeMatch(k).length*4+keep}})
    .sort((a,b)=>b.s-a.s).slice(0,6);
  const res=searchState.results;
  return`<form class="card" id="searchForm" role="search">
      <label class="label" for="q">${T("Search a place","Find a new fishing spot")}</label>
      <div class="search"><input id="q" type="text" value="${esc(searchState.q)}" placeholder="e.g. Jervis Bay, Balmoral" autocomplete="off"><button class="btn" type="submit" ${searchState.busy?"disabled":""}>${searchState.busy?"Searching…":"Search"}</button></div>
      <div class="row-btns"><button type="button" class="chip" aria-pressed="${!searchState.wide}" data-wide="0">Sydney</button><button type="button" class="chip" aria-pressed="${searchState.wide}" data-wide="1">Anywhere in Australia</button></div>
      ${searchState.err?`<p class="err">${esc(searchState.err)}</p>`:""}
      ${res?(res.length?`<div class="fish">${res.map((r,i)=>`<div class="fish-row"><span><b>${esc(r.name)}</b><br><span class="small muted">${esc([r.admin2,r.admin1].filter(Boolean).join(", "))}</span></span><button class="btn small" type="button" data-pick="${i}">Open</button></div>`).join("")}</div>`:`<p class="small muted">No places found. Try a suburb, beach or bay name.</p>`):""}
    </form>
    <h2>${T("Your spots","Your spots")}</h2>
    <div class="my-spots">${mySpots().map(k=>{const w=spotBest(k);return`<button class="my-spot" data-detail="${k}"><b>${esc(SPOTS[k].name)}</b><span class="small" style="color:var(--${w?band(w.v):"poor"});font-weight:700">${w?bandWord(w.v)+" · "+dayLabel(w.start)+" "+t12(new Date(w.start)):"No free time"}</span></button>`}).join("")}</div>
    <div class="sub"><h2>${T("Suggested for you","Spots to explore")}</h2><span class="small muted">Next 3 days</span></div>
    ${sug.map(o=>spotCard(o.k)).join("")}
    <p class="small muted">Spot list from the NSW DPI "Go Fishing: Sydney Harbour" guide. Locations marked approx are best guesses; check in Maps and follow local signs.</p>`;
}
async function doSearch(q){
  searchState={...searchState,q,busy:true,err:"",results:null};render();
  try{
    const r=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&language=en&countryCode=AU`);
    const j=r.ok?await r.json():{};let list=(j.results||[]);
    if(!searchState.wide)list=list.filter(x=>distKm(x.latitude,x.longitude,-33.86,151.2)<90);
    searchState.results=list.slice(0,6);
  }catch(e){searchState.err="Search isn't working right now. Check your connection and try again."}
  searchState.busy=false;render();
}
function placeFromResult(r){
  const k="p-"+String(r.id||(r.latitude.toFixed(3)+"_"+r.longitude.toFixed(3))).replace(/[^a-z0-9_.-]/gi,"");
  if(!SPOTS[k]){
    const safety=safetyFor(r.latitude,r.longitude);
    SPOTS[k]={name:r.name,area:[r.admin2,r.admin1].filter(Boolean).join(", "),lat:r.latitude,lon:r.longitude,type:["beach","rocks","jetty"],safety,searched:true,approx:true,
      pros:[],cons:["Found by search: check access, signs and closures before you go"]};
    const st=stationFor(k);
    if(st)SPOTS[k].pros.push("Tides from the "+window.STATIONS[st].name+" gauge ("+Math.round(distKm(r.latitude,r.longitude,window.STATIONS[st].lat,window.STATIONS[st].lon))+" km away)");
    else SPOTS[k].cons.push("No tide gauge nearby, so tide times aren't shown");
  }
  return k;
}

/* ---------- spot detail ---------- */
let MAP=null;
function castList(k){
  const s=SPOTS[k],starter=(s.casts||[]).map(c=>({...c,starter:true}));
  const shared=(SHARED.pins[k]||[]).map(p=>({id:p.id,n:p.name,f:p.fish||[],lat:p.lat,lon:p.lon,note:p.note,by:p.author,mine:p.user_id===MY_ID}));
  return starter.concat(shared);
}
function renderDetail(k){
  const s=SPOTS[k],saved=STORE.mySpots.includes(k),st=window.SAFETY[s.safety||"none"],casts=castList(k),comments=SHARED.comments[k]||[];
  const rows=SPECIES_KEYS.map(sp=>({sp,w:windowsFor(k,NOW.getTime(),dayStart(3).getTime(),[sp],true)})).filter(o=>o.w).sort((a,b)=>b.w.v-a.w.v).slice(0,4);
  const used=[...new Set(casts.flatMap(c=>c.f))];
  return`<a href="#spots" id="back" style="font-weight:700;text-decoration:none">‹ Spots</a>
  <section class="card">
    <div class="spot-head"><div><h2>${esc(s.name)}</h2><div class="small muted">${esc(s.area||"")}${s.type?" · "+s.type.join(", "):""}</div></div>
      <div class="row-btns"><button class="btn small ghost" data-save="${k}">${saved?"Saved ✓":"Save spot"}</button><button class="btn small" data-plan="${k}">Plan here</button></div></div>
    ${st?`<p class="small">${safetyBadge(k)} ${st.text}</p>`:""}
    <div id="map" class="map" role="region" aria-label="Map of ${esc(s.name)} with cast points"></div>
    ${used.length?`<div class="fish-dots">${used.map(f=>`<span><i class="dot" style="background:${SPECIES[f]?SPECIES[f].color:"#888"}"></i>${SPECIES[f]?SPECIES[f].name:esc(f)}</span>`).join("")}</div>`:""}
    <p class="small muted">${addingPin?"<b>Tap the map</b> where you cast, then fill in the form below.":`<a href="${mapsLink(s.lat,s.lon)}" target="_blank" rel="noopener">Open in Google Maps</a>${s.approx?" · location approximate":""}`}</p>
  </section>
  <section class="card">
    <div class="sub"><h2>${T("Cast points","Secret fishing spots")}</h2>${SB?`<button class="btn small ghost" id="addPin">${addingPin?"Cancel":"+ Add pin"}</button>`:""}</div>
    ${addingPin?pinForm():""}
    <div>${casts.length?casts.map((c,i)=>{const col=SPECIES[c.f[0]]?SPECIES[c.f[0]].color:"#13707A";return`<div class="cast"><span class="n" style="background:${col}">${i+1}</span><div class="body"><b>${esc(c.n)}</b>
      <span class="small muted">${c.f.map(f=>SPECIES[f]?SPECIES[f].name:f).join(", ")}${c.note?". "+esc(c.note):""}</span>
      <span class="small">${c.starter?(c.approx?"Starter point, approximate":"Starter point"):"Added by "+esc(c.by||"a friend")}${c.lat!=null?` · <a href="${mapsLink(c.lat,c.lon)}" target="_blank" rel="noopener">${c.lat.toFixed(4)}, ${c.lon.toFixed(4)}</a>`:""}${c.mine?` · <button class="btn small danger" data-delpin="${c.id}" style="min-height:28px;padding:2px 8px">Delete</button>`:""}</span></div></div>`}).join(""):`<p class="small muted">No cast points yet. ${SB?"Add the first one!":""}</p>`}</div>
  </section>
  <section class="card"><h2>${T("Best fish here, next 3 days","Who's biting here?")}</h2>
    <div class="fish">${rows.map(o=>`<div class="fish-row"><span class="name">${SPECIES[o.sp].name}</span>${pill(o.w.v,o.w)}<span class="num muted">${dayLabel(o.w.start)} ${rangeTxt(o.w)}</span><span></span></div>`).join("")||`<p class="small muted">No free time in the next 3 days.</p>`}</div></section>
  ${(s.pros||s.cons)?`<section class="card"><h2>Good to know</h2>${(s.pros||[]).map(p=>`<span class="pro">+ ${esc(p)}</span>`).join("")}${(s.cons||[]).map(p=>`<span class="con">– ${esc(p)}</span>`).join("")}</section>`:""}
  <section class="card"><h2>${T("Comments","Fish chat")}</h2>
    ${SB?`<form id="commentForm" class="search"><label for="cm" class="label" style="position:absolute;left:-9999px">Comment</label><input id="cm" type="text" maxlength="400" placeholder="${T("e.g. Squid on the wharf at dusk","Tell your friends what you caught!")}"><button class="btn" type="submit">Post</button></form><p class="err" id="cmErr" hidden></p>`:`<p class="small muted">Shared comments aren't set up yet.</p>`}
    <div>${comments.map(c=>`<div class="comment"><span class="small"><b>${esc(c.author||"A friend")}</b> · ${dayLabel(new Date(c.created_at).getTime())}</span><span>${esc(c.body)}</span>${c.user_id===MY_ID?`<button class="btn small danger" data-delcm="${c.id}" style="align-self:flex-start;min-height:28px;padding:2px 8px">Delete</button>`:""}</div>`).join("")}</div>
  </section>`;
}
function pinForm(){
  const a=addingPin;
  return`<form id="pinForm" class="form">
    <div class="field"><label class="label" for="pn">Name</label><input id="pn" type="text" maxlength="60" value="${esc(a.name||"")}" placeholder="e.g. End of the wharf"><span class="err" id="pnErr" hidden>Give the spot a name first</span></div>
    <div class="field"><span class="label">Fish</span><div class="who">${SPECIES_KEYS.map(f=>`<button type="button" class="chip" aria-pressed="${(a.fish||[]).includes(f)}" data-pf="${f}">${SPECIES[f].name}</button>`).join("")}</div></div>
    <div class="field"><label class="label" for="pnote">Tip (optional)</label><input id="pnote" type="text" maxlength="280" value="${esc(a.note||"")}" placeholder="e.g. Bream on the run-in, use prawns"></div>
    <p class="small ${a.lat!=null?"":"err"}" id="pinWhere">${a.lat!=null?"Location set: "+a.lat.toFixed(4)+", "+a.lon.toFixed(4):"Tap the map to set the location"}</p>
    <div class="row-btns"><button class="btn" type="submit">Save pin</button></div>
    <p class="err" id="pinErr" hidden></p>
  </form>`;
}
function mountMap(k){
  const el=document.getElementById("map");if(!el||!window.L)return;
  if(MAP){MAP.remove();MAP=null}
  const s=SPOTS[k];
  MAP=L.map(el,{zoomControl:true,attributionControl:true}).setView([s.lat,s.lon],16);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(MAP);
  castList(k).forEach((c,i)=>{if(c.lat==null)return;const col=SPECIES[c.f[0]]?SPECIES[c.f[0]].color:"#13707A";
    L.marker([c.lat,c.lon],{icon:L.divIcon({className:"pin-label",html:`<div style="background:${col}">${i+1}</div>`,iconSize:[24,24],iconAnchor:[12,12]}),title:c.n}).addTo(MAP).bindPopup(`<b>${esc(c.n)}</b><br>${c.f.map(f=>SPECIES[f]?SPECIES[f].name:f).join(", ")}`)});
  if(addingPin){
    let tmp=addingPin.lat!=null?L.circleMarker([addingPin.lat,addingPin.lon],{radius:10,color:"#E5533D"}).addTo(MAP):null;
    MAP.on("click",e=>{addingPin.lat=e.latlng.lat;addingPin.lon=e.latlng.lng;if(tmp)tmp.remove();tmp=L.circleMarker(e.latlng,{radius:10,color:"#E5533D"}).addTo(MAP);
      const w=document.getElementById("pinWhere");if(w){w.textContent="Location set: "+addingPin.lat.toFixed(4)+", "+addingPin.lon.toFixed(4);w.className="small"}});
  }
}
function refreshDetail(){if(detail&&currentView()==="spots"){const y=window.scrollY;render();window.scrollTo(0,y)}}

/* ---------- me ---------- */
function renderMe(){
  if(editing)return editHTML(editing);
  return`<section class="card"><h2>${T("Who's fishing","Your crew")}</h2><p class="muted small">Each person has a character with their free time, favourite fish and look. Tap the names at the top to choose who's going, and the app finds times that suit everyone. Characters are saved on this phone.</p>
  <div class="people">${STORE.people.map(p=>`<div class="person"><span class="nm"><span class="dot" style="background:${esc(p.color)};width:14px;height:14px"></span>${esc(p.name)}${p.example?' <span class="small muted">(example)</span>':""}${p.tone==="fishy"?' <span class="badge info">Fishy mode</span>':""}${p.crewId&&crewName(p.crewId)?' <span class="badge info">'+esc(crewName(p.crewId))+'</span>':""}</span><button class="btn ghost small" data-edit="${esc(p.id)}">Edit</button></div>`).join("")}</div>
  <div class="row-btns"><button class="btn" id="add">Add a character</button></div></section>
  ${crewCardHTML()}
  <section class="card"><div class="sub"><h2>${T("Rig and bait guides","How-to guides")}</h2><a href="#guides" class="small">See all ›</a></div><div class="fish">${(window.GUIDES||[]).map(g=>`<div class="fish-row"><a href="#guide-${g.id}" class="name">${esc(g.title)}</a><a class="small" href="${g.pdf}" target="_blank" rel="noopener">PDF</a></div>`).join("")}</div></section>
  <section class="card"><h2>About the data</h2><p class="small muted">Tides are calculated from tide-gauge constants and match the Bureau of Meteorology tables for Fort Denison to within a few minutes. Weather and water temperature come live from Open-Meteo every time you open the app. Shared pins and comments are ${SB?"switched on":"not set up"}.</p></section>`;
}
function editHTML(p){
  const grid=`<div class="grid-free"><span></span>${SLOTS.map(s=>`<span class="h">${s[1]}</span>`).join("")}${WD.map(d=>`<span class="d">${d}</span>`+SLOTS.map(s=>`<button type="button" aria-label="${d} ${s[1]}" aria-pressed="${(p.free[d]||[]).includes(s[0])}" data-free="${d}|${s[0]}"></button>`).join("")).join("")}</div>`;
  const types=[["jetty","Jetty or wharf"],["rocks","Rocks"],["beach","Beach"],["seawall","Seawall or park"]];
  return`<form class="card form" id="edit" novalidate>
    <h2>${p.example?"Set up your character":"Edit "+esc(p.name)}</h2>
    <div class="field"><label class="label" for="nm">Name</label><input type="text" id="nm" value="${esc(p.example?"":p.name)}" placeholder="e.g. Captain Kai" maxlength="24"><span class="err" id="nmErr" hidden>Enter a name first</span></div>
    <div class="field"><span class="label">Look and feel</span><div class="who"><button type="button" class="chip" aria-pressed="${p.tone!=="fishy"}" data-tone="calm">Calm</button><button type="button" class="chip" aria-pressed="${p.tone==="fishy"}" data-tone="fishy">Fishy mode (kids)</button></div></div>
    <div class="field"><span class="label">Colour</span><div class="who">${COLORS.map(c=>`<button type="button" class="chip" aria-pressed="${p.color===c}" data-col="${c}" aria-label="Colour"><span class="dot" style="background:${c};width:16px;height:16px"></span></button>`).join("")}</div></div>
    <div class="field"><span class="label">Free time</span><span class="small muted">Tap the times you can usually fish.</span>${grid}</div>
    <div class="field"><span class="label">Favourite spot types</span><div class="who">${types.map(t=>`<button type="button" class="chip" aria-pressed="${(p.spotTypes||[]).includes(t[0])}" data-type="${t[0]}">${t[1]}</button>`).join("")}</div></div>
    <div class="field"><span class="label">Target fish</span><div class="who">${SPECIES_KEYS.map(k=>`<button type="button" class="chip" aria-pressed="${(p.targets||[]).includes(k)}" data-fish="${k}">${SPECIES[k].name}</button>`).join("")}</div></div>
    <div class="field"><span class="label">Bait or lure</span><div class="who">${[["bait","Bait"],["lure","Lure"],["both","Both"]].map(m=>`<button type="button" class="chip" aria-pressed="${p.method===m[0]}" data-meth="${m[0]}">${m[1]}</button>`).join("")}</div></div>
    <div class="row-btns"><button class="btn" type="submit">Save</button><button class="btn ghost" type="button" id="cancel">Cancel</button>
    ${STORE.people.length>1?(confirmDel===p.id?`<button class="btn danger" type="button" id="delYes">Tap again to delete</button>`:`<button class="btn danger" type="button" id="del">Delete</button>`):""}</div>
  </form>`;
}

/* ---------- score sheet ---------- */
function showWhy(spot,sp,t,opener){
  const r=score(spot,sp,t),S=SPECIES[sp],tw=r.B.reduce((a,b)=>a+b.w,0);
  const facs=r.B.map(f=>`<div class="fac"><b>${f.k}</b><span class="small muted num">${Math.round(f.w/tw*100)}% of score · ${Math.round(f.s*100)}/100</span><span class="bar"><i style="width:${Math.round(f.s*100)}%"></i></span><span class="n">${esc(f.n)}</span></div>`).join("");
  const miss=r.B.some(f=>f.k==="Wind and rain")?"":"<p class=\"small muted\">Wind and rain aren't in this score because the forecast hasn't loaded.</p>";
  const bg=document.createElement("div");bg.className="sheet-bg";
  bg.innerHTML=`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="whyT">
    <div class="sheet-head"><div><p class="label">${T("How this score works","How bite power works")}</p><h2 id="whyT">${S.name} at ${esc(SPOTS[spot].name)}</h2><p class="small muted num">${dayLabel(t)} around ${t12(new Date(t))}</p></div><span class="pill ${band(r.v)}">${bandWord(r.v)} · ${r.v}</span></div>
    <p class="small">Each factor gets a mark out of 100. The marks are averaged using the weights shown, then adjusted for the season and how well this spot suits the fish.</p>
    ${facs}${miss}
    <div class="mult"><span><b>Season</b> ×${r.seasonF.toFixed(2)}: ${S.name} ${S.season[r.mon]>=.85?"bite well":S.season[r.mon]>=.6?"are around":"are quieter"} in ${MONTHS[r.mon]}.</span><span><b>Spot fit</b> ×${r.suitF.toFixed(2)}: how well ${esc(SPOTS[spot].name)} suits ${S.name.toLowerCase()}.</span><span class="num"><b>Result</b> ${Math.round(r.base*100)} × ${r.seasonF.toFixed(2)} × ${r.suitF.toFixed(2)} = ${r.v}</span></div>
    <p class="small muted">${bandWord(80)} is 70 and up, ${bandWord(60)} is 55 to 69, ${bandWord(40)} is under 55. Only times inside your free time are picked. The rules come from local fishing advice and are a guide, not a promise.</p>
    <button class="btn" type="button" id="whyClose">Close</button></div>`;
  document.body.appendChild(bg);
  const close=()=>{bg.remove();document.removeEventListener("keydown",onKey);opener&&opener.focus&&opener.focus()};
  const onKey=e=>{if(e.key==="Escape")close()};document.addEventListener("keydown",onKey);
  bg.onclick=e=>{if(e.target===bg)close()};const c=bg.querySelector("#whyClose");c.onclick=close;c.focus();
}

/* ---------- render & wiring ---------- */
const VIEWS=["today","next-3-days","week","spots","catches","guides","me"];
function currentView(){const v0=(location.hash||"#today").slice(1);const v=v0.startsWith("guide-")?"guides":v0;return VIEWS.includes(v)?v:"today"}
function render(){
  document.documentElement.classList.toggle("fishy",fishy());
  const view=currentView();
  document.querySelectorAll("nav.tabs a").forEach(a=>a.setAttribute("aria-current",a.dataset.v===(view==="next-3-days"?"week":view)?"page":"false"));
  $("#mark").textContent=fishy()?"Fishy Finds":"Fishy Friends";
  $("#title").textContent=view==="today"?(selDay===0?T("Today","Today's quest"):fDayLong.format(dayStart(selDay))):view==="next-3-days"?"Next 3 days":view==="week"?"This week":view==="spots"?(detail?SPOTS[detail].name:"Spots"):view==="catches"?T("Catches","Fish cards"):view==="guides"?T("Rig and bait guides","How-to guides"):T("Characters","Your crew");
  document.title=fishy()?"Fishy Finds · Fishy Friends":"Fishy Friends";
  renderWho();
  if(MAP){MAP.remove();MAP=null}
  const el=$("#view");
  el.innerHTML=view==="today"?renderToday():view==="next-3-days"?renderDays(3):view==="week"?renderDays(7):view==="spots"?renderSpots():view==="catches"?renderCatches():view==="guides"?renderGuides():renderMe();
  wire(el,view);
  $("#foot").innerHTML=`<p>Tide times are calculated from tide-gauge data (TICON-4 via <a href="https://neaps.js.org/" target="_blank" rel="noopener">Neaps</a>) and checked against the Bureau of Meteorology. Heights are approximate. Not for navigation.</p>
    <p>Weather, water temperature and place search from <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>. Maps © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>. Seafood advice: <a href="https://www.health.nsw.gov.au/environment/factsheets/Pages/dioxins.aspx" target="_blank" rel="noopener">NSW Health</a>.</p>
    <p>Bite scores are a guide built from local fishing advice, not a promise. Size and bag limits from <a href="${window.RULES_SOURCE}" target="_blank" rel="noopener">NSW DPI</a>; always check the latest rules.</p>`;
}
function wire(el,view){
  el.querySelectorAll("[data-spot]").forEach(b=>b.onclick=()=>{selSpot=b.dataset.spot;ensureWeather([selSpot]);render()});
  el.querySelectorAll("[data-day]").forEach(b=>b.onclick=()=>{selDay=+b.dataset.day;refreshKeep()});
  wireTideScroll(el);
  el.querySelectorAll("[data-open]").forEach(b=>{const go=()=>{selDay=+b.dataset.open;location.hash="#today";window.scrollTo(0,0)};
    b.onclick=e=>{if(e.target.closest("[data-why]"))return;go()};b.onkeydown=e=>{if((e.key==="Enter"||e.key===" ")&&!e.target.closest("[data-why]")){e.preventDefault();go()}}});
  el.querySelectorAll("[data-why]").forEach(b=>b.onclick=e=>{e.stopPropagation();const[sp,f,t]=b.dataset.why.split("|");showWhy(sp,f,+t,b)});
  el.querySelectorAll("[data-detail]").forEach(b=>b.onclick=()=>openDetail(b.dataset.detail));
  el.querySelectorAll("[data-save]").forEach(b=>b.onclick=()=>{const k=b.dataset.save;
    if(STORE.mySpots.includes(k)){STORE.mySpots=STORE.mySpots.filter(x=>x!==k);if(!STORE.mySpots.length)STORE.mySpots=["mortbay"]}
    else{STORE.mySpots.push(k);if(SPOTS[k].searched)STORE.places[k]=SPOTS[k];ensureWeather([k])}
    save();refreshKeep()});
  el.querySelectorAll("[data-plan]").forEach(b=>b.onclick=()=>{const k=b.dataset.plan;if(!STORE.mySpots.includes(k)){STORE.mySpots.push(k);if(SPOTS[k].searched)STORE.places[k]=SPOTS[k];save()}selSpot=k;selDay=0;detail=null;location.hash="#today";window.scrollTo(0,0)});
  if(view==="spots"&&!detail){
    const f=el.querySelector("#searchForm");
    f.onsubmit=e=>{e.preventDefault();const q=f.querySelector("#q").value.trim();if(!q){searchState.err="Type a place name first";render();return}doSearch(q)};
    f.querySelector("#q").oninput=()=>{searchState.q=f.querySelector("#q").value};
    f.querySelectorAll("[data-wide]").forEach(b=>b.onclick=()=>{searchState.wide=b.dataset.wide==="1";searchState.q=f.querySelector("#q").value;render()});
    f.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>openDetail(placeFromResult(searchState.results[+b.dataset.pick])));
  }
  if(view==="spots"&&detail)wireDetail(el,detail);
  if(view==="me")wireMe(el);
  if(view==="catches")wireCatches(el);
  wireQuests(el);
  if(view==="guides")wireGuide(el);
}
function refreshKeep(){const y=window.scrollY;render();window.scrollTo(0,y)}
function openDetail(k){detail=k;addingPin=null;if(location.hash!=="#spots")location.hash="#spots";else render();ensureWeather([k]);loadShared(k).then(refreshDetail).catch(()=>{});window.scrollTo(0,0)}
function wireDetail(el,k){
  const back=el.querySelector("#back");if(back)back.onclick=e=>{e.preventDefault();detail=null;addingPin=null;render();window.scrollTo(0,0)};
  mountMap(k);
  const ap=el.querySelector("#addPin");if(ap)ap.onclick=()=>{addingPin=addingPin?null:{fish:[]};refreshKeep()};
  const pf=el.querySelector("#pinForm");
  if(pf){
    pf.querySelectorAll("[data-pf]").forEach(b=>b.onclick=()=>{const f=b.dataset.pf;addingPin.fish=addingPin.fish.includes(f)?addingPin.fish.filter(x=>x!==f):[...addingPin.fish,f];b.setAttribute("aria-pressed",addingPin.fish.includes(f))});
    pf.querySelector("#pn").oninput=e=>{addingPin.name=e.target.value;pf.querySelector("#pnErr").hidden=true};
    pf.querySelector("#pnote").oninput=e=>{addingPin.note=e.target.value};
    pf.onsubmit=async e=>{e.preventDefault();const err=pf.querySelector("#pinErr");err.hidden=true;
      const name=(addingPin.name||"").trim();if(!name){pf.querySelector("#pnErr").hidden=false;pf.querySelector("#pn").focus();return}
      if(addingPin.lat==null){const w=pf.querySelector("#pinWhere");w.className="err";w.textContent="Tap the map to set the location first";return}
      const btn=pf.querySelector("button[type=submit]");btn.disabled=true;btn.textContent="Saving…";
      try{await ensureUser();const r=await SB.from("pins").insert({spot:k,name,fish:addingPin.fish,note:(addingPin.note||"").trim()||null,lat:addingPin.lat,lon:addingPin.lon,author:authorName()});
        if(r.error)throw r.error;addingPin=null;await loadShared(k);refreshKeep();
      }catch(x){console.error(x);btn.disabled=false;btn.textContent="Save pin";err.hidden=false;err.textContent="Couldn't save the pin. Check your connection and try again."}};
  }
  el.querySelectorAll("[data-delpin]").forEach(b=>b.onclick=async()=>{if(b.dataset.armed!=="1"){b.dataset.armed="1";b.textContent="Tap again to delete";return}
    b.disabled=true;const r=await SB.from("pins").delete().eq("id",b.dataset.delpin);if(!r.error){await loadShared(k);refreshKeep()}else{b.textContent="Couldn't delete"}});
  const cf=el.querySelector("#commentForm");
  if(cf)cf.onsubmit=async e=>{e.preventDefault();const inp=cf.querySelector("#cm"),err=el.querySelector("#cmErr"),body=inp.value.trim();err.hidden=true;
    if(!body){err.hidden=false;err.textContent="Write something first";inp.focus();return}
    const btn=cf.querySelector("button");btn.disabled=true;
    try{await ensureUser();const r=await SB.from("comments").insert({spot:k,body,author:authorName()});if(r.error)throw r.error;inp.value="";await loadShared(k);refreshKeep()}
    catch(x){console.error(x);err.hidden=false;err.textContent="Couldn't post. Check your connection and try again.";btn.disabled=false}};
  el.querySelectorAll("[data-delcm]").forEach(b=>b.onclick=async()=>{if(b.dataset.armed!=="1"){b.dataset.armed="1";b.textContent="Tap again to delete";return}
    b.disabled=true;const r=await SB.from("comments").delete().eq("id",b.dataset.delcm);if(!r.error){await loadShared(k);refreshKeep()}});
}
function wireMe(el){
  wireCrew(el);
  const add=el.querySelector("#add");
  if(add)add.onclick=()=>{editing={id:"p"+Date.now().toString(36),name:"",color:COLORS[STORE.people.length%COLORS.length],free:defaultFree(),spotTypes:[],targets:[],method:"bait",tone:"calm",isNew:true};render()};
  el.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{editing=JSON.parse(JSON.stringify(STORE.people.find(x=>x.id===b.dataset.edit)));confirmDel=null;render()});
  const f=el.querySelector("#edit");if(!f)return;
  const tog=(arr,v)=>arr.includes(v)?arr.filter(x=>x!==v):[...arr,v];
  const nm=f.querySelector("#nm");if(editing.nameDraft!=null)nm.value=editing.nameDraft;
  nm.oninput=()=>{editing.nameDraft=nm.value;f.querySelector("#nmErr").hidden=true};
  f.querySelectorAll("[data-free]").forEach(b=>b.onclick=()=>{const[d,s]=b.dataset.free.split("|");editing.free[d]=tog(editing.free[d]||[],s);b.setAttribute("aria-pressed",editing.free[d].includes(s))});
  f.querySelectorAll("[data-type]").forEach(b=>b.onclick=()=>{editing.spotTypes=tog(editing.spotTypes||[],b.dataset.type);b.setAttribute("aria-pressed",editing.spotTypes.includes(b.dataset.type))});
  f.querySelectorAll("[data-fish]").forEach(b=>b.onclick=()=>{editing.targets=tog(editing.targets||[],b.dataset.fish);b.setAttribute("aria-pressed",editing.targets.includes(b.dataset.fish))});
  f.querySelectorAll("[data-meth]").forEach(b=>b.onclick=()=>{editing.method=b.dataset.meth;f.querySelectorAll("[data-meth]").forEach(x=>x.setAttribute("aria-pressed",x.dataset.meth===editing.method))});
  f.querySelectorAll("[data-tone]").forEach(b=>b.onclick=()=>{editing.tone=b.dataset.tone;f.querySelectorAll("[data-tone]").forEach(x=>x.setAttribute("aria-pressed",x.dataset.tone===editing.tone))});
  f.querySelectorAll("[data-col]").forEach(b=>b.onclick=()=>{editing.color=b.dataset.col;f.querySelectorAll("[data-col]").forEach(x=>x.setAttribute("aria-pressed",x.dataset.col===editing.color))});
  f.onsubmit=e=>{e.preventDefault();const name=nm.value.trim();if(!name){f.querySelector("#nmErr").hidden=false;nm.focus();return}
    const keep=Object.assign({},editing);["example","isNew","nameDraft"].forEach(k=>delete keep[k]);
    const p={...keep,id:editing.example?"p"+Date.now().toString(36):editing.id,name,color:editing.color,free:editing.free,spotTypes:editing.spotTypes,targets:editing.targets.length?editing.targets:["bream"],method:editing.method,tone:editing.tone||"calm"};
    const i=STORE.people.findIndex(x=>x.id===editing.id);if(i>=0)STORE.people[i]=p;else STORE.people.push(p);
    if(editing.example)STORE.active=STORE.active.map(a=>a===editing.id?p.id:a);
    if(editing.isNew)STORE.active=[...STORE.active,p.id];
    editing=null;confirmDel=null;save();render()};
  f.querySelector("#cancel").onclick=()=>{editing=null;confirmDel=null;render()};
  const del=f.querySelector("#del");if(del)del.onclick=()=>{editing.nameDraft=nm.value;confirmDel=editing.id;render()};
  const yes=f.querySelector("#delYes");if(yes)yes.onclick=()=>{STORE.people=STORE.people.filter(x=>x.id!==editing.id);STORE.active=STORE.active.filter(a=>a!==editing.id);if(!STORE.active.length)STORE.active=[STORE.people[0].id];editing=null;confirmDel=null;save();render()};
}

/* ---------- start ---------- */
function ensureWeather(keys){const zones=[...new Set(keys.map(wxKey))];zones.forEach(z=>{if(!WX[z])loadWeather(z).then(()=>refreshKeep())})}
window.addEventListener("hashchange",()=>{editing=null;if(currentView()!=="spots"){detail=null;addingPin=null}if(currentView()!=="catches"&&CATCH.mode!=="new"){CATCH.mode="feed";CATCH.openId=null}render();window.scrollTo(0,0)});
if(SB)loadCrews().then(()=>{if(fishy())loadProgress().then(refreshKeep);else refreshKeep()});
render();
ensureWeather([...mySpots(),...Object.keys(window.CURATED_SPOTS)]);
setInterval(()=>{const d=dayKey(NOW);setClock();if(dayKey(NOW)!==d){for(const k in TIDES)delete TIDES[k]}if(!document.querySelector(".sheet-bg")&&!editing&&!addingPin&&CATCH.mode!=="new"&&document.activeElement.tagName!=="INPUT")refreshKeep()},5*60000);
