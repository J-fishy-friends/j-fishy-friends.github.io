/* Fishy Friends version 5a: crews, quests, badges, levels and the crew leaderboard.
   Quests, badges and levels show in Fishy mode only. Crews work in both modes.
   Progress is worked out from the catches already saved, so nothing extra is stored except
   crews (Supabase), each character's crew, picked quests and finished guides (this phone). */
"use strict";

/* ---------- crews ---------- */
const CREW = {list: null, members: null, loading: false, err: ""};
/* Each loader runs once at a time and always ends with a list (empty on failure), so a redraw can't loop. */
function loadCrews(){
  if (!SB) { CREW.list = CREW.list || []; return Promise.resolve(); }
  if (CREW.p) return CREW.p;
  CREW.loading = true;
  CREW.p = (async () => {
    try {
      const [r, m] = await Promise.all([SB.from("crews").select("id,name,created_at,user_id").order("name").limit(200),
        SB.from("crew_members").select("id,crew_id,name,user_id").order("created_at").limit(2000)]);
      CREW.list = r.error ? [] : r.data; CREW.err = r.error ? "Crews aren't set up yet." : "";
      CREW.members = m.error ? null : m.data;
      await syncMembership();
    }
    catch (e) { CREW.list = CREW.list || []; CREW.err = "Couldn't load crews. Check your connection."; }
  })().finally(() => { CREW.loading = false; CREW.p = null; });
  return CREW.p;
}
const crewName = id => { const c = (CREW.list || []).find(x => x.id === id); return c ? c.name : null; };
/* A crew someone else dispersed no longer counts, so its id is dropped from this phone. */
const myCrewId = () => { const p = activePeople()[0]; if (!p || !p.crewId) return null;
  if (CREW.list && !CREW.err && !CREW.list.some(c => c.id === p.crewId)) return null; return p.crewId; };
const membersOf = id => (CREW.members || []).filter(m => m.crew_id === id);
const iMadeCrew = c => !!MY_ID && c.user_id === MY_ID;
/* Make sure the shared member list matches the crew this character picked (covers people who joined before the list existed). */
async function syncMembership(){
  const p = me0(); if (!p || p.example || !CREW.members || !MY_ID) return;
  const want = myCrewId(), name = p.name;
  const mine = CREW.members.filter(m => m.user_id === MY_ID && m.name.toLowerCase() === name.toLowerCase());
  const names = STORE.people.filter(x => !x.example).map(x => x.name.toLowerCase());
  const wrong = mine.filter(m => m.crew_id !== want)
    .concat(CREW.members.filter(m => m.user_id === MY_ID && !names.includes(m.name.toLowerCase())));
  if (wrong.length) { await SB.from("crew_members").delete().in("id", wrong.map(m => m.id)); CREW.members = CREW.members.filter(m => !wrong.includes(m)); }
  if (want && !mine.some(m => m.crew_id === want)) {
    const r = await SB.from("crew_members").insert({crew_id: want, name}).select().single();
    if (!r.error) CREW.members.push(r.data);
  }
}

/* ---------- my catches (this character, all time) and crew catches (this year) ---------- */
const PROG = {mine: null, crewYear: null, at: 0, key: ""};
function playerKey(){ const p = activePeople()[0]; return (MY_ID || "") + "|" + (p ? p.name : ""); }
function loadProgress(force){
  if (!SB) { PROG.mine = PROG.mine || []; PROG.crewYear = PROG.crewYear || []; return Promise.resolve(); }
  if (PROG.p) return PROG.p;
  const key = playerKey() + "|" + (myCrewId() || "");
  if (!force && PROG.key === key && Date.now() - PROG.at < 60000) return Promise.resolve();
  PROG.p = (async () => {
    try {
      await ensureUser();
      const me = myCharacter();
      let q = SB.from("catches").select("id,fish,length_cm,kept,spot,spot_name,tide,caught_at,author,user_id,crew_id").eq("user_id", MY_ID).order("caught_at").limit(2000);
      if (me) q = q.eq("author", me);
      const yearStart = new Date(Date.UTC(P(new Date()).y, 0, 1) - 11 * HOUR).toISOString();
      const crew = myCrewId();
      const [a, b] = await Promise.all([q, crew ? SB.from("catches").select("id,fish,kept,caught_at,author,user_id,length_cm").eq("crew_id", crew).gte("caught_at", yearStart).limit(5000) : Promise.resolve({data: []})]);
      PROG.mine = a.data || []; PROG.crewYear = b.data || [];
    } catch (e) { console.warn("progress", e); PROG.mine = PROG.mine || []; PROG.crewYear = PROG.crewYear || []; }
    PROG.at = Date.now(); PROG.key = key;
  })().finally(() => { PROG.p = null; });
  return PROG.p;
}

/* ---------- skills (finished guides) and picked quests: saved on this phone per character ---------- */
function me0(){ return activePeople()[0]; }
function skills(){ const p = me0(); return (p && p.skills) || {}; }
function markSkill(id){ const p = me0(); if (!p) return; p.skills = Object.assign({}, p.skills, {[id]: new Date().toISOString()}); save(); }

/* ---------- badges ---------- */
const RIG_GUIDES = ["running-sinker", "paternoster", "unweighted", "soft-plastic", "squid-jig"];
function dawnCatch(c){ const t = new Date(c.caught_at).getTime(), sp = c.spot && SPOTS[c.spot] ? c.spot : "mortbay"; const s = sunFor(t, sp); return t >= s.rise - 20 * 60000 && t <= s.rise + 60 * 60000; }
const BADGES = [
  {id:"rookie", name:"Rookie", how:"Catch your first fish", icon:"1", test:m => [Math.min(m.n, 1), 1]},
  {id:"bream5", name:"Bream Buster", how:"Catch 5 bream", icon:"B", test:m => [m.count("bream"), 5]},
  {id:"bream10", name:"Bream Master", how:"Catch 10 bream", icon:"B+", test:m => [m.count("bream"), 10]},
  {id:"flat", name:"Flat Out", how:"Catch your first flathead", icon:"F", test:m => [Math.min(m.count("flathead"), 1), 1]},
  {id:"ink", name:"Ink Master", how:"Catch your first squid", icon:"S", test:m => [Math.min(m.count("squid"), 1), 1]},
  {id:"dawn", name:"Dawn Patrol", how:"Catch a fish in the hour after sunrise", icon:"D", test:m => [Math.min(m.list.filter(dawnCatch).length, 1), 1]},
  {id:"kind", name:"Kind Angler", how:"Release 5 fish", icon:"K", test:m => [m.released, 5]},
  {id:"hero", name:"Release Hero", how:"Release 20 fish", icon:"R", test:m => [m.released, 20]},
  {id:"measure", name:"Measure Master", how:"Measure 10 catches", icon:"M", test:m => [m.list.filter(c => c.length_cm).length, 10]},
  {id:"knot", name:"Knot Ninja", how:"Finish the knots guide", icon:"N", test:m => [m.sk.knots ? 1 : 0, 1]},
  {id:"rig", name:"Rig Builder", how:"Finish 3 rig guides", icon:"G", test:m => [RIG_GUIDES.filter(g => m.sk[g]).length, 3]},
  {id:"hop", name:"Harbour Hopper", how:"Fish at 5 different spots", icon:"H", test:m => [new Set(m.list.map(c => c.spot_name).filter(Boolean)).size, 5]},
  {id:"rainbow", name:"Rainbow Catch", how:"Catch 5 different kinds of fish", icon:"5", test:m => [m.species, 5]},
  {id:"tide", name:"Tide Reader", how:"Catch 3 fish while the tide is moving", icon:"T", test:m => [m.list.filter(c => c.tide === "Run-in" || c.tide === "Run-out").length, 3]},
  {id:"legend", name:"Legend Hunter", how:"Earn a Legend card", icon:"L", test:m => [m.list.some(c => rarityOf(c.fish, +c.length_cm) >= 3) ? 1 : 0, 1]},
  {id:"all", name:"Full Collection", how:"Catch all 11 starter fish", icon:"11", test:m => [SPECIES_KEYS.filter(k => m.count(k) > 0).length, 11]},
  {id:"captain", name:"Crew Captain", how:"Help your crew finish 3 crew quests", icon:"C", test:m => [m.crewWins, 3]}
];
function crewWinDays(){
  const by = {};
  (PROG.crewYear || []).forEach(c => { const k = dayKey(new Date(c.caught_at)); (by[k] = by[k] || []).push(c); });
  const me = myCharacter();
  return Object.values(by).filter(list => new Set(list.map(c => c.fish)).size >= 3 && list.some(c => c.user_id === MY_ID && (!me || c.author === me))).length;
}
function metrics(list){
  list = list || PROG.mine || [];
  const count = f => list.filter(c => c.fish === f).length;
  return {list, n: list.length, count, released: list.filter(c => !c.kept).length, species: new Set(list.map(c => c.fish)).size, sk: skills(), crewWins: crewWinDays()};
}
function earnedBadges(list){ const m = metrics(list); return BADGES.filter(b => { const [have, need] = b.test(m); return have >= need; }).map(b => b.id); }

/* ---------- XP and levels ---------- */
const LEVELS = [["Tadpole", 0], ["Minnow", 100], ["Reef Ranger", 300], ["Harbour Hero", 700], ["Legend", 1500]];
function xpOf(list){
  list = list || PROG.mine || [];
  const seen = new Set(); let xp = 0;
  list.forEach(c => { xp += 10; if (!c.kept) xp += 5; if (!seen.has(c.fish)) { seen.add(c.fish); xp += 20; } });
  xp += Object.keys(skills()).length * 15;
  xp += earnedBadges(list).length * 25;
  const p = me0(); xp += ((p && p.questsDone) || []).length * 30;
  return xp;
}
function levelOf(xp){ let i = 0; LEVELS.forEach((l, j) => { if (xp >= l[1]) i = j; }); const next = LEVELS[i + 1]; return {name: LEVELS[i][0], i, xp, next: next ? next[1] : null, from: LEVELS[i][1]}; }

/* ---------- quests ---------- */
function seed(str){ let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const todayKey = () => dayKey(new Date());
function todayMine(){ const k = todayKey(); return (PROG.mine || []).filter(c => dayKey(new Date(c.caught_at)) === k); }
function todayCrew(){ const k = todayKey(); return (PROG.crewYear || []).filter(c => dayKey(new Date(c.caught_at)) === k); }
function dailyQuest(){
  let best = null;
  for (const sp of mySpots()) { const w = dayWindow(0, sp, SPECIES_KEYS, false); if (w && (!best || w.v > best.v)) best = w; }
  const fish = best ? best.sp : SPECIES_KEYS[seed(todayKey()) % SPECIES_KEYS.length];
  const got = todayMine().filter(c => c.fish === fish).length;
  return {id: "daily-" + fish, title: `Catch a ${SPECIES[fish].name.toLowerCase()} today`, sub: best ? `Best bite: ${SPOTS[best.spot].name}, ${rangeTxt(best)}` : "", have: Math.min(got, 1), need: 1};
}
function questPool(){
  const s = seed(todayKey() + playerKey()), fish = SPECIES_KEYS[(s >> 3) % SPECIES_KEYS.length];
  const t = todayMine(), sk = skills();
  const guideToday = Object.values(sk).some(d => dayKey(new Date(d)) === todayKey());
  return [
    {id: "two", title: "Catch 2 fish", have: Math.min(t.length, 2), need: 2},
    {id: "fish-" + fish, title: `Catch a ${SPECIES[fish].name.toLowerCase()}`, have: Math.min(t.filter(c => c.fish === fish).length, 1), need: 1},
    {id: "release", title: "Release a fish gently", have: Math.min(t.filter(c => !c.kept).length, 1), need: 1},
    {id: "measure", title: "Measure 2 fish", have: Math.min(t.filter(c => c.length_cm).length, 2), need: 2},
    {id: "dawn", title: "Catch a fish at dawn", have: Math.min(t.filter(dawnCatch).length, 1), need: 1},
    {id: "learn", title: "Finish a rig guide", have: guideToday ? 1 : 0, need: 1, link: "#guides"}
  ].sort((a, b) => seed(a.id + s) - seed(b.id + s)).slice(0, 3);
}
function pickedQuest(){ const p = me0(), k = todayKey(); return p && p.pick && p.pick.day === k ? questPool().find(q => q.id === p.pick.id) || null : null; }
function crewQuests(){
  if (!myCrewId()) return [];
  const t = todayCrew();
  return [{id: "crew3", title: "Catch 3 different fish as a crew", have: Math.min(new Set(t.map(c => c.fish)).size, 3), need: 3},
          {id: "crew10", title: "Catch 10 fish between you", have: Math.min(t.length, 10), need: 10}];
}
function recordQuestDone(q){
  const p = me0(); if (!p) return false; const id = todayKey() + ":" + q.id;
  p.questsDone = p.questsDone || []; if (p.questsDone.includes(id)) return false;
  p.questsDone.push(id); save(); return true;
}
function questRow(q, kind){
  const done = q.have >= q.need;
  return `<div class="quest ${done ? "done" : ""}"><div class="q-top"><span class="q-kind">${kind}</span>${done ? `<span class="pill good">Done!</span>` : `<span class="small num">${q.have}/${q.need}</span>`}</div>
    <b>${esc(q.title)}</b>${q.sub ? `<span class="small muted">${esc(q.sub)}</span>` : ""}
    <span class="bar-track" aria-hidden="true"><i style="width:${Math.round(q.have / q.need * 100)}%"></i></span>${q.link && !done ? `<a href="${q.link}" class="small">Go ›</a>` : ""}</div>`;
}
function questBoardHTML(){
  if (!fishy() || !SB) return "";
  if (PROG.mine === null) { loadProgress().then(refreshKeep); return `<section class="card"><h2>Today's quests</h2><p class="muted small">Loading…</p></section>`; }
  const d = dailyQuest(), pick = pickedQuest(), crew = crewQuests();
  [d, pick, ...crew].filter(q => q && q.have >= q.need).forEach(recordQuestDone);
  return `<section class="card quests"><div class="sub"><h2>Today's quests</h2><span class="small muted">+30 XP each</span></div>
    ${questRow(d, "Daily quest")}
    ${pick ? questRow(pick, "Your pick") : `<div class="quest"><span class="q-kind">Pick a quest</span><div class="pick-list">${questPool().map(q => `<button class="chip" data-pickq="${q.id}">${esc(q.title)}</button>`).join("")}</div></div>`}
    ${crew.length ? crew.map(q => questRow(q, esc(crewName(myCrewId()) || "Crew") + " quest")).join("") : `<p class="small muted">Join a crew on the Me tab for crew quests.</p>`}
  </section>`;
}

/* ---------- badges, level and leaderboard (Catches tab, Fishy mode) ---------- */
/* Easiest first. Kids see every badge they've earned plus the next 3 easiest; the rest stay secret. */
const BADGE_EASE = ["rookie", "knot", "flat", "ink", "tide", "dawn", "kind", "rig", "bream5", "rainbow", "measure", "hop", "bream10", "hero", "legend", "captain", "all"];
function shownBadges(got){
  const byEase = BADGE_EASE.map(id => BADGES.find(b => b.id === id)).filter(Boolean);
  const next = new Set(byEase.filter(b => !got.has(b.id)).slice(0, 3).map(b => b.id));
  return BADGES.filter(b => got.has(b.id) || next.has(b.id)).sort((a, b) => (got.has(b.id) - got.has(a.id)) || BADGE_EASE.indexOf(a.id) - BADGE_EASE.indexOf(b.id));
}
function progressHTML(){
  if (!fishy() || !SB) return "";
  if (PROG.mine === null) { loadProgress().then(refreshKeep); return ""; }
  const m = metrics(), lv = levelOf(xpOf()), got = new Set(earnedBadges());
  const pct = lv.next ? Math.round((lv.xp - lv.from) / (lv.next - lv.from) * 100) : 100;
  return `<section class="card"><div class="sub"><h2>${esc(lv.name)}</h2><span class="small num">${lv.xp} XP${lv.next ? " · " + (lv.next - lv.xp) + " to " + LEVELS[lv.i + 1][0] : ""}</span></div>
      <span class="bar-track" aria-hidden="true"><i style="width:${pct}%"></i></span>
      <p class="small muted">Catch +10 · Release +5 · New fish +20 · Badge +25 · Guide +15 · Quest +30</p></section>
    <section class="card"><div class="sub"><h2>Badges</h2><span class="small muted num">${got.size} of ${BADGES.length}</span></div>
      <div class="badge-grid">${shownBadges(got).map(b => { const [have, need] = b.test(m); const on = got.has(b.id);
        return `<div class="bdg ${on ? "on" : ""}" title="${esc(b.how)}"><span class="medal" aria-hidden="true">${esc(b.icon)}</span><b>${esc(b.name)}</b><span class="small muted">${on ? "Earned!" : esc(b.how) + " (" + Math.min(have, need) + "/" + need + ")"}</span></div>`; }).join("")}
        ${(() => { const hid = BADGES.length - shownBadges(got).length; return hid ? `<div class="bdg secret"><span class="medal" aria-hidden="true">?</span><b>${hid} secret badge${hid > 1 ? "s" : ""}</b><span class="small muted">Earn a badge to unlock the next one</span></div>` : ""; })()}</div></section>
    ${leaderboardHTML()}`;
}
function leaderboardHTML(){
  const crew = myCrewId(); if (!crew) return "";
  const pts = {};
  (PROG.crewYear || []).slice().sort((a, b) => a.caught_at < b.caught_at ? -1 : 1).forEach(c => {
    const k = c.user_id + "|" + (c.author || "A friend"); const p = pts[k] = pts[k] || {name: c.author || "A friend", pts: 0, n: 0, seen: new Set()};
    p.pts += 10 + (c.kept ? 0 : 5) + (p.seen.has(c.fish) ? 0 : 20); p.n++; p.seen.add(c.fish);
  });
  const rows = Object.entries(pts).map(([k, v]) => ({k, ...v})).sort((a, b) => b.pts - a.pts);
  const meK = playerKey(), meI = rows.findIndex(r => r.k === meK);
  const show = rows.slice(0, 3); if (meI >= 3) show.push(rows[meI]);
  return `<section class="card"><div class="sub"><h2>Most Fishy Friend ${P(new Date()).y}</h2><span class="small muted">${esc(crewName(crew) || "Your crew")}</span></div>
    ${rows.length ? `<ol class="board">${show.map(r => { const i = rows.indexOf(r); return `<li class="${r.k === meK ? "me" : ""}"><span class="rank">${i + 1}</span><b>${esc(r.name)}</b><span class="small muted">${r.n} fish · ${r.seen.size} kinds</span><span class="num"><b>${r.pts}</b> pts</span></li>`; }).join("")}</ol>` : `<p class="small muted">No crew catches yet this year. Be the first!</p>`}
    <p class="small muted">Catch +10, release +5, each new kind of fish +20. Adds up all year.</p></section>`;
}

/* ---------- crew card (Me tab, both modes) ---------- */
function crewCardHTML(){
  if (!SB) return "";
  if (CREW.list === null) { loadCrews().then(refreshKeep); return `<section class="card"><h2>Crew</h2><p class="small muted">Loading…</p></section>`; }
  const cur = myCrewId(), p = me0();
  const row = c => { const ms = membersOf(c.id), inIt = c.id === cur;
    return `<li class="crew-row${inIt ? " on" : ""}">
      <div class="crew-main"><b>${esc(c.name)}</b>
        <span class="small muted">${CREW.members === null ? "" : ms.length ? ms.map(m => esc(m.name)).join(", ") : "No one yet"}</span></div>
      <div class="crew-btns">
        ${inIt ? `<button class="btn ghost small" type="button" data-crew="">Leave</button>` : `<button class="btn small" type="button" data-crew="${c.id}">Join</button>`}
        ${iMadeCrew(c) ? `<button class="btn small danger" type="button" data-disperse="${c.id}">Disperse</button>` : ""}
      </div></li>`; };
  const list = [...CREW.list].sort((a, b) => (b.id === cur) - (a.id === cur));
  return `<section class="card"><div class="sub"><h2>${T("Crew", "Your fishing crew")}</h2>${cur ? `<span class="badge info">${esc(crewName(cur) || "Crew")}</span>` : ""}</div>
    <p class="small muted">${p && !p.example ? esc(p.name) + "'s crew. " : ""}Anyone can join a crew. Catches are shared with the crew${fishy() ? " and count towards crew quests and the leaderboard" : ""}. Only the person who made a crew can disperse it.</p>
    ${CREW.err ? `<p class="err">${esc(CREW.err)}</p>` : ""}
    ${list.length ? `<ul class="crew-list">${list.map(row).join("")}</ul>` : `<p class="small muted">No crews yet. Make the first one.</p>`}
    <form id="crewForm" class="search"><label for="crewName" class="label" style="position:absolute;left:-9999px">New crew name</label><input id="crewName" type="text" maxlength="30" placeholder="New crew name, e.g. Harbour Hunters"><button class="btn" type="submit">Create</button></form>
    <p class="err" id="crewErr" hidden></p></section>`;
}
function wireCrew(el){
  const err = el.querySelector("#crewErr");
  const say = t => { if (err) { err.hidden = false; err.textContent = t; } };
  el.querySelectorAll("[data-crew]").forEach(b => b.onclick = async () => {
    const p = me0(); if (!p) return; if (p.example) return say("Set up your character first (Edit above), then join a crew.");
    b.disabled = true;
    try { await ensureUser(); } catch (e) {}
    p.crewId = b.dataset.crew || null; save();
    try { await syncMembership(); } catch (e) { console.warn(e); }
    PROG.at = 0; loadProgress(true).then(refreshKeep); refreshKeep();
  });
  el.querySelectorAll("[data-disperse]").forEach(b => b.onclick = async () => {
    const c = (CREW.list || []).find(x => x.id === b.dataset.disperse); if (!c) return;
    if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Tap again to disperse"; setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = "Disperse"; } }, 4000); return; }
    b.disabled = true; b.textContent = "Dispersing…";
    const r = await SB.from("crews").delete().eq("id", c.id).select();
    if (r.error || !r.data || !r.data.length) { b.disabled = false; b.textContent = "Disperse"; delete b.dataset.sure; return say("Couldn't disperse the crew. Only the person who made it can, on the phone they made it on."); }
    STORE.people.forEach(x => { if (x.crewId === c.id) x.crewId = null; }); save();
    await loadCrews(); PROG.at = 0; loadProgress(true).then(refreshKeep); refreshKeep();
  });
  const f = el.querySelector("#crewForm"); if (!f) return;
  f.onsubmit = async e => {
    e.preventDefault(); const inp = f.querySelector("#crewName"), name = inp.value.trim(); err.hidden = true;
    if (!name) { say("Type a crew name first"); inp.focus(); return; }
    if ((CREW.list || []).some(c => c.name.toLowerCase() === name.toLowerCase())) return say("That crew already exists. Tap Join next to it.");
    if (me0().example) return say("Set up your character first (Edit above), then create a crew.");
    try { await ensureUser(); const r = await SB.from("crews").insert({name}).select().single(); if (r.error) throw r.error;
      me0().crewId = r.data.id; save(); await loadCrews(); PROG.at = 0; refreshKeep(); }
    catch (x) { console.error(x); say("Couldn't create the crew. Check your connection and try again."); }
  };
}

/* ---------- celebration after logging a catch (Fishy mode) ---------- */
async function snapshotProgress(){ await loadProgress(true); return {badges: new Set(earnedBadges()), xp: xpOf(), level: levelOf(xpOf()).name, quests: [dailyQuest(), pickedQuest(), ...crewQuests()].filter(q => q && q.have >= q.need).map(q => q.id)}; }
async function celebrate(before, fish){
  if (!fishy() || !before) return;
  await loadProgress(true);
  const nb = BADGES.filter(b => earnedBadges().includes(b.id) && !before.badges.has(b.id));
  const qs = [dailyQuest(), pickedQuest(), ...crewQuests()].filter(q => q && q.have >= q.need && !before.quests.includes(q.id));
  qs.forEach(recordQuestDone);
  const xp = xpOf(), lv = levelOf(xp);
  const bg = document.createElement("div"); bg.className = "sheet-bg";
  bg.innerHTML = `<div class="sheet celebrate" role="dialog" aria-modal="true" aria-labelledby="celT">
    <div class="confetti" aria-hidden="true">${Array.from({length: 24}, (_, i) => `<i style="left:${(i * 37) % 100}%;animation-delay:${(i % 8) * 0.12}s;background:${["#FFC93C", "#FF6F59", "#14A3A1", "#2E3A8C", "#3BB273"][i % 5]}"></i>`).join("")}</div>
    <h2 id="celT">New card! ${esc(SPECIES[fish] ? SPECIES[fish].name : "")}</h2>
    <p class="num"><b>+${xp - before.xp} XP</b>${lv.name !== before.level ? ` · Level up: <b>${esc(lv.name)}</b>!` : ""}</p>
    ${qs.map(q => `<div class="rulebox keep"><b>Quest complete!</b><span>${esc(q.title)}</span></div>`).join("")}
    ${nb.map(b => `<div class="rulebox info"><b>New badge: ${esc(b.name)}</b><span>${esc(b.how)}</span></div>`).join("")}
    <button class="btn" type="button" id="celOk">See my card</button></div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove(); bg.onclick = e => { if (e.target === bg) close(); }; bg.querySelector("#celOk").onclick = close; bg.querySelector("#celOk").focus();
}

/* ---------- wiring for quest picks ---------- */
function wireQuests(el){
  el.querySelectorAll("[data-pickq]").forEach(b => b.onclick = () => { const p = me0(); if (!p) return; p.pick = {day: todayKey(), id: b.dataset.pickq}; save(); refreshKeep(); });
}
