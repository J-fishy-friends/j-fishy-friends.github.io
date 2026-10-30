/* Fishy Friends version 3: catch log, catch cards and collections.
   Uses globals from app.js (SPECIES, SB, ensureUser, tides, etc.); only called after app.js has loaded. */
"use strict";

/* ---------- fish icons (simple original drawings) ---------- */
const FISH_SHAPE = {
  bream:{rx:15,ry:10}, mullet:{rx:17,ry:7}, leatherjacket:{rx:13,ry:11,spike:true}, trevally:{rx:15,ry:10},
  flathead:{rx:19,ry:5}, whiting:{rx:18,ry:6}, luderick:{rx:15,ry:9,stripes:true}, tailor:{rx:17,ry:7},
  snapper:{rx:15,ry:11,bump:true}, kingfish:{rx:19,ry:7,yellowTail:true}
};
function fishIcon(sp, size=48, grey=false){
  const col = grey ? "#B8C4C6" : (SPECIES[sp] ? SPECIES[sp].color : "#7F8C8D"), ink = grey ? "#8A9A9D" : "#1A1D3A";
  if (sp === "squid") return `<svg viewBox="0 0 60 40" width="${size}" height="${size*2/3}" aria-hidden="true"><path d="M8 20 Q 30 2 46 20 Q 30 38 8 20 Z" transform="rotate(180 30 20)" fill="${col}" stroke="${ink}" stroke-width="2"/><path d="M14 16 L4 12 M14 20 L2 20 M14 24 L4 28" stroke="${ink}" stroke-width="2" stroke-linecap="round" transform="translate(42 0) scale(-1 1) translate(-12 0)"/><circle cx="40" cy="18" r="2" fill="${ink}"/></svg>`;
  const s = FISH_SHAPE[sp] || {rx:15, ry:9};
  const tailCol = s.yellowTail && !grey ? "#F2C230" : col;
  return `<svg viewBox="0 0 60 40" width="${size}" height="${size*2/3}" aria-hidden="true">
    <path d="M${30+s.rx-2} 20 L${30+s.rx+12} ${20-s.ry*0.9} L${30+s.rx+9} 20 L${30+s.rx+12} ${20+s.ry*0.9} Z" fill="${tailCol}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>
    <ellipse cx="28" cy="20" rx="${s.rx}" ry="${s.ry}" fill="${col}" stroke="${ink}" stroke-width="2"/>
    ${s.spike?`<path d="M24 ${20-s.ry} L22 ${20-s.ry-7}" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`:""}
    ${s.stripes&&!grey?`<path d="M24 ${20-s.ry+2} L24 ${20+s.ry-2} M30 ${20-s.ry+1} L30 ${20+s.ry-1}" stroke="${ink}" stroke-width="1.2" opacity=".5"/>`:""}
    ${s.bump?`<path d="M${28-s.rx+3} ${18} Q ${28-s.rx+5} ${20-s.ry-2} ${28-s.rx+10} ${20-s.ry+1}" fill="none" stroke="${ink}" stroke-width="2"/>`:""}
    <circle cx="${28-s.rx+6}" cy="18" r="2" fill="${ink}"/></svg>`;
}

/* ---------- rules, rarity, tide at catch ---------- */
function rarityOf(sp, len){
  const r = window.RARITY[sp] || {base:0, big:999};
  return Math.min(3, r.base + (len && len >= r.big ? 1 : 0));
}
const rarityName = i => window.RARITY_NAMES[fishy() ? "fishy" : "calm"][i];
function ruleCheck(sp, len, spot){
  const R = window.RULES[sp], s = spot && SPOTS[spot];
  const west = s && s.safety === "west";
  const lim = R ? `NSW: ${R.min ? "min " + R.min + " cm" : "no minimum size"}${R.max ? ", max " + R.max + " cm" : ""}, bag ${R.bag} a day.` : "";
  let status = "ok", head = "";
  if (!R) { status = "unknown"; head = "Check the NSW rules for this fish"; }
  else if (len && R.min && len < R.min) { status = "under"; head = T("Undersize: release it", "Too little! Splash it back to grow"); }
  else if (len && R.max && len > R.max) { status = "over"; head = T("Over the maximum size: release it", "A giant breeder! Splash it back"); }
  else if (!len && R.min) { status = "unsure"; head = T("Measure it before keeping", "Measure it first!"); }
  else { head = T("Legal size to keep", "Big enough to keep!"); }
  if (west && status === "ok") { status = "west"; head = T("Legal size, but release it here", "Big enough, but splash it back here"); }
  const extra = west ? window.SAFETY.west.text : (s && s.safety === "east" ? window.SAFETY.east.text : "");
  return {status, head, lim, note: R ? R.note : "", extra, canKeep: status === "ok"};
}
function tideWord(spot, t){
  if (!spot || !SPOTS[spot]) return "";
  const ts = tideStage(t, spot); if (!ts) return "";
  return ts.stage === "in" ? "Run-in" : ts.stage === "out" ? "Run-out" : (ts.near && ts.near.high ? "High slack" : "Low slack");
}
const photoUrl = p => p && SB ? SB.storage.from("catch-photos").getPublicUrl(p).data.publicUrl : "";

/* ---------- data ---------- */
const CATCH = {list: null, cheers: [], loading: false, err: "", mode: "feed", filter: "all", openId: null, draft: null, saving: false, chan: null};
async function loadCatches(){
  if (!SB) { CATCH.list = []; return; }
  CATCH.loading = true;
  const [a, b] = await Promise.all([
    SB.from("catches").select("*").order("caught_at", {ascending: false}).limit(100),
    SB.from("cheers").select("catch_id,user_id").limit(2000)
  ]);
  CATCH.loading = false;
  if (a.error) { CATCH.err = "Couldn't load catches. Check your connection."; CATCH.list = CATCH.list || []; return; }
  CATCH.err = ""; CATCH.list = a.data || []; CATCH.cheers = b.data || [];
  if (!CATCH.chan) {
    CATCH.chan = SB.channel("catches")
      .on("postgres_changes", {event: "*", schema: "public", table: "catches"}, () => loadCatches().then(refreshCatches))
      .on("postgres_changes", {event: "*", schema: "public", table: "cheers"}, () => loadCatches().then(refreshCatches))
      .subscribe();
  }
}
function refreshCatches(){ if (currentView() === "catches" && CATCH.mode !== "new") refreshKeep(); }
const cheersFor = id => CATCH.cheers.filter(c => c.catch_id === id);
const iCheered = id => CATCH.cheers.some(c => c.catch_id === id && c.user_id === MY_ID);
function myCharacter(){ const p = activePeople()[0]; return p && !p.example ? p.name : null; }

/* ---------- views ---------- */
function renderCatches(){
  if (!SB) return `<section class="card"><h2>Catches</h2><p class="muted">Shared catch cards aren't set up on this copy of the app.</p></section>`;
  if (CATCH.list === null) { loadCatches().then(refreshKeep); return `<section class="card"><p class="muted">Loading catches…</p></section>`; }
  if (CATCH.mode === "new") return renderNewCatch();
  if (CATCH.mode === "card" && CATCH.openId) { const c = CATCH.list.find(x => x.id === CATCH.openId); if (c) return renderCardPage(c); CATCH.mode = "feed"; }
  const me = myCharacter();
  let list = CATCH.list;
  if (CATCH.filter === "mine") list = list.filter(c => c.user_id === MY_ID && (!me || c.author === me));
  return `<div class="row-btns"><button class="btn" id="newCatch" style="flex:1">${T("Log a catch", "I caught a fish!")}</button></div>
    ${collectionHTML()}
    <div class="seg" role="group" aria-label="Show"><button class="chip" aria-pressed="${CATCH.filter === "all"}" data-cf="all">Everyone</button><button class="chip" aria-pressed="${CATCH.filter === "mine"}" data-cf="mine">${me ? esc(me) + "'s" : "Mine"}</button></div>
    ${CATCH.err ? `<p class="err">${esc(CATCH.err)}</p>` : ""}
    ${list.length ? `<div class="feed">${list.map(miniCard).join("")}</div>` : `<section class="card"><p class="muted">${T("No catches yet. Log the first one!", "No cards yet. Go catch one!")}</p></section>`}`;
}
function collectionHTML(){
  const me = myCharacter();
  const mine = CATCH.list.filter(c => c.user_id === MY_ID && (!me || c.author === me));
  const got = new Set(mine.map(c => c.fish));
  const best = Math.max(-1, ...mine.map(c => rarityOf(c.fish, +c.length_cm)));
  return `<section class="card"><div class="sub"><h2>${T("Collection", "Your fish collection")}</h2><span class="small muted num">${got.size} of ${SPECIES_KEYS.length} ${T("species", "found")}</span></div>
    <div class="collection">${SPECIES_KEYS.map(sp => `<div class="coll-item ${got.has(sp) ? "got" : ""}" title="${SPECIES[sp].name}">${fishIcon(sp, 40, !got.has(sp))}<span>${got.has(sp) ? SPECIES[sp].name : "?"}</span></div>`).join("")}</div>
    <div class="bar-track" aria-hidden="true"><i style="width:${Math.round(got.size / SPECIES_KEYS.length * 100)}%"></i></div>
    ${best >= 0 ? `<p class="small muted">${T("Best card", "Rarest card")}: ${rarityName(best)} · ${mine.length} ${mine.length === 1 ? "catch" : "catches"} logged</p>` : `<p class="small muted">${me ? "" : "Set up your character on the Me tab so your catches show your name."}</p>`}
  </section>`;
}
function miniCard(c){
  const r = rarityOf(c.fish, +c.length_cm), n = cheersFor(c.id).length, img = photoUrl(c.photo_path);
  return `<button class="mini" data-card="${c.id}" style="--rc:${window.RARITY_COLORS[r]}">
    <span class="mini-img">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : fishIcon(c.fish, 64)}</span>
    <span class="mini-body"><b>${esc(SPECIES[c.fish] ? SPECIES[c.fish].name : c.fish)}</b>
      <span class="small muted">${c.length_cm ? esc(c.length_cm) + " cm · " : ""}${esc(c.author || "A friend")} · ${dayLabel(new Date(c.caught_at).getTime())}</span>
      <span class="small"><span class="rar">${rarityName(r)}</span>${c.kept ? " · Kept" : " · Released"}${n ? " · " + n + " " + T("cheers", "high fives") : ""}</span></span></button>`;
}
function bigCard(c){
  const r = rarityOf(c.fish, +c.length_cm), S = SPECIES[c.fish] || {name: c.fish}, img = photoUrl(c.photo_path);
  const rule = ruleCheck(c.fish, +c.length_cm, c.spot);
  return `<article class="fcard" style="--rc:${window.RARITY_COLORS[r]}">
    <div class="fcard-band"><span class="fcard-name">${esc(S.name)}</span><span class="fcard-rar">${rarityName(r)}</span></div>
    <div class="fcard-img">${img ? `<img src="${esc(img)}" alt="Photo of ${esc(S.name)} caught by ${esc(c.author || "a friend")}">` : fishIcon(c.fish, 140)}</div>
    <div class="fcard-body">
      <div class="stats num"><div><span>Size</span><b>${c.length_cm ? esc(c.length_cm) + " cm" : "–"}</b></div><div><span>Fight</span><b>${c.fight ? "★".repeat(c.fight) + "☆".repeat(5 - c.fight) : "–"}</b></div><div><span>Tide</span><b>${esc(c.tide || "–")}</b></div></div>
      <p class="small">${esc(window.FACTS[c.fish] || "")}</p>
      <div class="rulebox ${c.kept ? "keep" : "rel"}"><b>${c.kept ? T("Kept", "Taken home") : T("Released", "Splashed back!")}</b><span>${esc(rule.lim)} ${esc(rule.note)}</span></div>
      <p class="small muted">${esc(c.author || "A friend")} · ${esc(c.spot_name || "")} · ${dayLabel(new Date(c.caught_at).getTime())} ${t12(new Date(c.caught_at))}${c.bait ? " · " + esc(c.bait) : ""}</p>
      ${c.note ? `<p class="small">"${esc(c.note)}"</p>` : ""}
    </div></article>`;
}
function renderCardPage(c){
  const n = cheersFor(c.id).length, mine = c.user_id === MY_ID, comments = SHARED.comments["catch:" + c.id] || [];
  if (!SHARED.comments["catch:" + c.id]) loadCardComments(c.id);
  return `<a href="#catches" id="cBack" style="font-weight:700;text-decoration:none">‹ ${T("Catches", "All cards")}</a>
    ${bigCard(c)}
    <div class="row-btns"><button class="btn ${iCheered(c.id) ? "" : "ghost"}" data-cheer="${c.id}">${iCheered(c.id) ? T("Cheered", "High-fived!") : T("Nice catch!", "High five!")}${n ? " · " + n : ""}</button>
      ${mine ? `<button class="btn danger" data-delcatch="${c.id}">Delete</button>` : ""}</div>
    <section class="card"><h2>${T("Comments", "Fish chat")}</h2>
      <form id="ccForm" class="search"><label for="ccm" class="label" style="position:absolute;left:-9999px">Comment</label><input id="ccm" type="text" maxlength="400" placeholder="${T("Say something nice", "Say well done!")}"><button class="btn" type="submit">Post</button></form><p class="err" id="ccErr" hidden></p>
      <div>${comments.map(m => `<div class="comment"><span class="small"><b>${esc(m.author || "A friend")}</b> · ${dayLabel(new Date(m.created_at).getTime())}</span><span>${esc(m.body)}</span></div>`).join("")}</div>
    </section>`;
}
async function loadCardComments(id){
  const r = await SB.from("comments").select("*").eq("spot", "catch:" + id).order("created_at", {ascending: false}).limit(50);
  SHARED.comments["catch:" + id] = r.data || []; refreshKeep();
}

/* ---------- new catch form ---------- */
function nowLocalInput(){ const p = P(new Date()); const z = n => String(n).padStart(2, "0"); return `${p.y}-${z(p.m)}-${z(p.d)}T${z(p.h)}:${z(p.min)}`; }
function renderNewCatch(){
  const d = CATCH.draft;
  const rule = d.fish ? ruleCheck(d.fish, +d.length || 0, d.spot) : null;
  const cls = rule ? (rule.canKeep ? "keep" : (rule.status === "unsure" || rule.status === "unknown" ? "info" : "rel")) : "";
  const spots = [...new Set([...mySpots(), d.spot].filter(Boolean))];
  return `<a href="#catches" id="cBack" style="font-weight:700;text-decoration:none">‹ ${T("Catches", "All cards")}</a>
  <form class="card form" id="catchForm" novalidate>
    <h2>${T("Log a catch", "New card!")}</h2>
    <div class="field"><span class="label">Photo</span>
      ${d.preview ? `<div class="photo-pick"><img src="${d.preview}" alt="Your photo"></div>` : ""}
      <div class="row-btns photo-btns">
        <label class="btn ghost small">${T("Choose from photos", "Pick a photo")}<input type="file" id="cPhoto" accept="image/*"></label>
        <label class="btn ghost small">${T("Take a photo", "Snap your fish!")}<input type="file" id="cCamera" accept="image/*" capture="environment"></label>
        ${d.preview ? `<button type="button" class="btn danger small" id="cNoPhoto">Remove photo</button>` : ""}
      </div>
      ${d.photoErr ? `<span class="err">${esc(d.photoErr)}</span>` : `<span class="small muted">Optional. It's shrunk to save space and shared with friends.</span>`}</div>
    <div class="field"><span class="label">${T("Which fish?", "What did you catch?")}</span>
      <div class="fish-pick">${SPECIES_KEYS.map(sp => `<button type="button" class="fp" aria-pressed="${d.fish === sp}" data-fp="${sp}">${fishIcon(sp, 44)}<span>${SPECIES[sp].name}</span></button>`).join("")}</div>
      <span class="err" id="fishErr" ${d.fishErr ? "" : "hidden"}>Pick the fish first</span></div>
    <div class="field"><label class="label" for="cLen">Length (cm)</label><input type="text" inputmode="decimal" id="cLen" value="${esc(d.length || "")}" placeholder="Nose to tail tip"><span class="err" id="lenErr" hidden>Enter a length like 28 or 28.5</span></div>
    ${rule ? `<div class="rulebox ${cls}" id="ruleBox" aria-live="polite"><b>${esc(rule.head)}</b><span>${esc(rule.lim)} ${esc(rule.note)}</span>${rule.extra ? `<span>${esc(rule.extra)}</span>` : ""}<a href="${window.RULES_SOURCE}" target="_blank" rel="noopener" class="small">NSW rules</a></div>` : ""}
    <div class="field"><span class="label">${T("Kept or released?", "Did you keep it?")}</span><div class="who">
      <button type="button" class="chip" aria-pressed="${!d.kept}" data-kept="0">${T("Released", "Splashed it back")}</button>
      <button type="button" class="chip" aria-pressed="${!!d.kept}" data-kept="1" ${rule && !rule.canKeep && rule.status !== "unsure" && rule.status !== "unknown" ? "disabled" : ""}>${T("Kept", "Kept it")}</button></div>
      <span class="err" id="keptErr" hidden></span></div>
    <div class="field"><label class="label" for="cSpot">Where</label><select id="cSpot" class="sel">${spots.map(k => `<option value="${k}" ${d.spot === k ? "selected" : ""}>${esc(SPOTS[k].name)}</option>`).join("")}<option value="" ${!d.spot ? "selected" : ""}>Somewhere else</option></select></div>
    <div class="field"><label class="label" for="cWhen">When</label><input type="datetime-local" id="cWhen" class="sel" value="${esc(d.when)}"></div>
    <div class="field"><span class="label">${T("Fight", "How hard did it pull?")}</span><div class="who">${[1,2,3,4,5].map(n => `<button type="button" class="chip" aria-pressed="${d.fight === n}" data-fight="${n}" aria-label="${n} out of 5">${"★".repeat(n)}</button>`).join("")}</div></div>
    <div class="field"><label class="label" for="cBait">Bait or lure (optional)</label><input type="text" id="cBait" maxlength="80" value="${esc(d.bait || "")}" placeholder="e.g. Prawn on a running sinker"></div>
    <div class="field"><label class="label" for="cNote">Note (optional)</label><input type="text" id="cNote" maxlength="280" value="${esc(d.note || "")}" placeholder="${T("e.g. Took the bait right at the pylons", "e.g. It jumped out of the water!")}"></div>
    <div class="row-btns"><button class="btn" type="submit" ${CATCH.saving ? "disabled" : ""}>${CATCH.saving ? "Saving…" : T("Save catch", "Make my card!")}</button><button class="btn ghost" type="button" id="cCancel">Cancel</button></div>
    <p class="err" id="saveErr" hidden></p>
  </form>`;
}
function startNewCatch(){
  CATCH.draft = {fish: null, length: "", kept: false, spot: selSpot || mySpots()[0], when: nowLocalInput(), fight: 3, bait: "", note: "", blob: null, preview: null};
  CATCH.mode = "new"; refreshKeep(); window.scrollTo(0, 0);
}
async function shrinkPhoto(file){
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const max = 1200, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(ok => c.toBlob(ok, "image/jpeg", 0.78));
    if (!blob) throw new Error("encode");
    return blob;
  } finally { URL.revokeObjectURL(url); }
}
function parseWhen(v){
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v || ""); if (!m) return Date.now();
  const guess = Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]);
  const off = (() => { const p = P(new Date(guess)); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - guess; })();
  return guess - off;
}

/* ---------- wiring ---------- */
function wireCatches(el){
  const back = el.querySelector("#cBack"); if (back) back.onclick = e => { e.preventDefault(); CATCH.mode = "feed"; CATCH.openId = null; refreshKeep(); window.scrollTo(0, 0); };
  const nb = el.querySelector("#newCatch"); if (nb) nb.onclick = startNewCatch;
  el.querySelectorAll("[data-cf]").forEach(b => b.onclick = () => { CATCH.filter = b.dataset.cf; refreshKeep(); });
  el.querySelectorAll("[data-card]").forEach(b => b.onclick = () => { CATCH.mode = "card"; CATCH.openId = b.dataset.card; render(); window.scrollTo(0, 0); });
  el.querySelectorAll("[data-cheer]").forEach(b => b.onclick = async () => {
    b.disabled = true; const id = b.dataset.cheer;
    try { await ensureUser(); if (iCheered(id)) await SB.from("cheers").delete().eq("catch_id", id).eq("user_id", MY_ID); else await SB.from("cheers").insert({catch_id: id}); await loadCatches(); }
    catch (e) { console.error(e); }
    refreshKeep();
  });
  el.querySelectorAll("[data-delcatch]").forEach(b => b.onclick = async () => {
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Tap again to delete"; return; }
    b.disabled = true; const c = CATCH.list.find(x => x.id === b.dataset.delcatch);
    const r = await SB.from("catches").delete().eq("id", c.id);
    if (!r.error) { if (c.photo_path) await SB.storage.from("catch-photos").remove([c.photo_path]); CATCH.mode = "feed"; await loadCatches(); refreshKeep(); }
    else { b.textContent = "Couldn't delete"; }
  });
  const cc = el.querySelector("#ccForm");
  if (cc) cc.onsubmit = async e => {
    e.preventDefault(); const inp = cc.querySelector("#ccm"), err = el.querySelector("#ccErr"), body = inp.value.trim(); err.hidden = true;
    if (!body) { err.hidden = false; err.textContent = "Write something first"; inp.focus(); return; }
    try { await ensureUser(); const r = await SB.from("comments").insert({spot: "catch:" + CATCH.openId, body, author: authorName()}); if (r.error) throw r.error; inp.value = ""; await loadCardComments(CATCH.openId); }
    catch (x) { console.error(x); err.hidden = false; err.textContent = "Couldn't post. Check your connection and try again."; }
  };
  const f = el.querySelector("#catchForm"); if (!f) return;
  const d = CATCH.draft;
  const keepFields = () => { d.length = f.querySelector("#cLen").value.trim(); d.spot = f.querySelector("#cSpot").value; d.when = f.querySelector("#cWhen").value; d.bait = f.querySelector("#cBait").value; d.note = f.querySelector("#cNote").value; };
  const rerender = () => { keepFields(); const y = window.scrollY; render(); window.scrollTo(0, y); };
  f.querySelector("#cCancel").onclick = () => { CATCH.mode = "feed"; CATCH.draft = null; refreshKeep(); };
  f.querySelectorAll("[data-fp]").forEach(b => b.onclick = () => { d.fish = b.dataset.fp; d.fishErr = false; const rc = ruleCheck(d.fish, +f.querySelector("#cLen").value || 0, f.querySelector("#cSpot").value); if (d.kept && !rc.canKeep && rc.status !== "unsure" && rc.status !== "unknown") d.kept = false; rerender(); });
  f.querySelectorAll("[data-kept]").forEach(b => b.onclick = () => { d.kept = b.dataset.kept === "1"; rerender(); });
  f.querySelectorAll("[data-fight]").forEach(b => b.onclick = () => { d.fight = +b.dataset.fight; rerender(); });
  f.querySelector("#cLen").onchange = () => { keepFields(); if (d.fish) { const rc = ruleCheck(d.fish, +d.length || 0, d.spot); if (d.kept && !rc.canKeep && rc.status !== "unsure") d.kept = false; } rerender(); };
  f.querySelector("#cSpot").onchange = rerender;
  const noPhoto = f.querySelector("#cNoPhoto"); if (noPhoto) noPhoto.onclick = () => { if (d.preview) URL.revokeObjectURL(d.preview); d.preview = null; d.blob = null; rerender(); };
  const onPhoto = async e => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    keepFields(); d.photoErr = "";
    try { d.blob = await shrinkPhoto(file); if (d.preview) URL.revokeObjectURL(d.preview); d.preview = URL.createObjectURL(d.blob); }
    catch (x) { d.blob = null; d.photoErr = "That photo couldn't be read. Try a JPEG or PNG photo."; }
    rerender();
  };
  f.querySelector("#cPhoto").onchange = onPhoto;
  f.querySelector("#cCamera").onchange = onPhoto;
  f.onsubmit = async e => {
    e.preventDefault(); keepFields();
    const err = f.querySelector("#saveErr"); err.hidden = true;
    if (!d.fish) { d.fishErr = true; rerender(); document.getElementById("fishErr")?.scrollIntoView({block: "center"}); return; }
    const len = d.length ? parseFloat(d.length.replace(",", ".")) : null;
    if (d.length && (!(len > 0) || len > 300)) { const le = f.querySelector("#lenErr"); le.hidden = false; f.querySelector("#cLen").focus(); return; }
    const rc = ruleCheck(d.fish, len || 0, d.spot);
    if (d.kept && !rc.canKeep) { const ke = f.querySelector("#keptErr"); ke.hidden = false; ke.textContent = rc.status === "unsure" ? "Measure it first: enter the length before keeping it." : rc.head; return; }
    CATCH.saving = true; rerender();
    try {
      const uid = await ensureUser();
      let photo_path = null;
      if (d.blob) {
        photo_path = uid + "/" + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)) + ".jpg";
        const up = await SB.storage.from("catch-photos").upload(photo_path, d.blob, {contentType: "image/jpeg", upsert: false});
        if (up.error) throw up.error;
      }
      const t = parseWhen(d.when);
      const row = {fish: d.fish, length_cm: len, fight: d.fight || null, kept: !!d.kept, spot: d.spot || null, spot_name: d.spot ? SPOTS[d.spot].name : "Somewhere else",
        bait: d.bait.trim() || null, note: d.note.trim() || null, tide: tideWord(d.spot, t) || null, photo_path, author: authorName(), caught_at: new Date(t).toISOString()};
      const r = await SB.from("catches").insert(row).select().single();
      if (r.error) throw r.error;
      CATCH.saving = false; if (d.preview) URL.revokeObjectURL(d.preview);
      CATCH.draft = null; await loadCatches(); CATCH.mode = "card"; CATCH.openId = r.data.id; render(); window.scrollTo(0, 0);
    } catch (x) {
      console.error(x); CATCH.saving = false; rerender();
      const e2 = document.getElementById("saveErr"); if (e2) { e2.hidden = false; e2.textContent = "Couldn't save the catch. Check your connection and try again."; }
    }
  };
}
