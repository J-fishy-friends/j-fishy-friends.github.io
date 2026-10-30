/* Fishy Friends version 4: rig and bait guide pages. Data comes from js/guides.js (built by tools/build_guides.py). */
"use strict";
const GUIDE_FOR = {bream:"running-sinker", flathead:"running-sinker", leatherjacket:"paternoster", whiting:"running-sinker", tailor:"soft-plastic",
  luderick:"unweighted", squid:"squid-jig", snapper:"unweighted", trevally:"paternoster", mullet:"unweighted", kingfish:"soft-plastic"};
const LURE_GUIDE = {flathead:"soft-plastic", bream:"soft-plastic"};
function guideFor(sp){
  const lure = activePeople().some(p => p.method === "lure");
  return (lure && LURE_GUIDE[sp]) || GUIDE_FOR[sp] || "running-sinker";
}
const guideById = id => (window.GUIDES || []).find(g => g.id === id);

/* Draw a guide diagram (the same drawing used in the PDF) as SVG. */
function guideSVG(items, title){
  const a = v => esc(String(v));
  const st = o => o || {};
  const parts = items.map(it => {
    const k = it[0], o = st(it[it.length - 1]);
    const stroke = o.stroke || o.c, fill = o.fill && o.fill !== "none" ? o.fill : "none";
    const sw = o.w || 1.5, dash = o.dash ? ` stroke-dasharray="4 3"` : "";
    const sAttr = stroke ? ` stroke="${a(stroke)}" stroke-width="${sw}"${dash}` : "";
    if (k === "line") return `<line x1="${it[1]}" y1="${it[2]}" x2="${it[3]}" y2="${it[4]}" stroke="${a(o.c || "#10262B")}" stroke-width="${sw}" stroke-linecap="round"${dash}/>`;
    if (k === "circle") return `<circle cx="${it[1]}" cy="${it[2]}" r="${it[3]}" fill="${a(fill)}"${sAttr}/>`;
    if (k === "ellipse") return `<ellipse cx="${it[1]}" cy="${it[2]}" rx="${it[3]}" ry="${it[4]}" fill="${a(fill)}"${sAttr}/>`;
    if (k === "rect") return `<rect x="${it[1]}" y="${it[2]}" width="${it[3]}" height="${it[4]}" fill="${a(fill)}"${sAttr}/>`;
    if (k === "poly") return `<polygon points="${it[1].map(p => p.join(",")).join(" ")}" fill="${a(fill)}"${sAttr} stroke-linejoin="round"/>`;
    if (k === "path") return `<path d="${it[1].map(s => s[0] + " " + s.slice(1).join(" ")).join(" ")}" fill="${a(fill)}"${sAttr || ` stroke="#10262B" stroke-width="1.5"`} stroke-linecap="round" stroke-linejoin="round"/>`;
    if (k === "text") return `<text x="${it[1]}" y="${it[2]}" text-anchor="${a(o.anchor || "middle")}" font-size="${o.size || 10}" font-weight="${o.bold ? 700 : 400}" fill="${a(o.c || "#56696D")}" font-family="Atkinson Hyperlegible, system-ui, sans-serif">${esc(it[3])}</text>`;
    return "";
  }).join("");
  return `<svg class="guide-svg" viewBox="0 0 320 200" role="img" aria-label="Diagram: ${esc(title)}"><rect width="320" height="200" fill="#FFFFFF"/>${parts}</svg>`;
}

function renderGuides(){
  const h = location.hash.slice(1);
  if (h.startsWith("guide-")) { const g = guideById(h.slice(6)); if (g) return renderGuide(g); }
  const list = window.GUIDES || [];
  return `<p class="muted">${T("Simple picture guides for rigs, knots and bait. Open one on the jetty, or save the PDF to print.", "Learn to tie rigs like a pro! Each guide has pictures and easy steps.")}</p>
    <div class="guide-list">${list.map(g => `<a class="guide-tile" href="#guide-${g.id}">${guideSVG(g.draw, g.title)}<b>${esc(g.title)}</b><span class="small muted">${g.for.map(f => SPECIES[f] ? SPECIES[f].name : f).join(", ")}</span></a>`).join("")}</div>`;
}
function renderGuide(g){
  return `<a href="#guides" style="font-weight:700;text-decoration:none">‹ ${T("All guides", "All guides")}</a>
  <section class="card">
    <h2>${esc(g.title)}</h2>
    <p>${esc(g.intro)}</p>
    <div class="guide-pic">${guideSVG(g.draw, g.title)}</div>
    <div class="badges">${g.for.map(f => `<span class="badge info">${SPECIES[f] ? SPECIES[f].name : esc(f)}</span>`).join("")}</div>
  </section>
  <section class="card"><h3>You need</h3><p>${esc(g.you_need)}</p>
    <h3>Steps</h3><p class="small muted">Tick each step as you do it.</p><ol class="steps check">${g.steps.map((s, i) => `<li><label><input type="checkbox" data-step="${i}"> ${esc(s)}</label></li>`).join("")}</ol>
    ${skills()[g.id] ? `<div class="rulebox keep"><b>${T("Done", "You did it!")}</b><span>${T("You finished this guide.", "Guide finished: +15 XP")}</span></div>` : `<button class="btn" type="button" data-skill="${g.id}" disabled>${T("I did it", "I did it! +15 XP")}</button>`}
    <div class="rulebox info"><b>${T("Kid tip", "Fishy tip")}</b><span>${esc(g.kid_tip)}</span></div>
    <div class="rulebox rel"><b>Stay safe</b><span>${esc(g.safety)}</span></div>
  </section>
  <section class="card"><h3>Watch and save</h3>
    <div class="row-btns">
      ${g.video ? `<a class="btn" href="${esc(g.video.url)}" target="_blank" rel="noopener">Watch video</a>` : ""}
      <a class="btn ghost" href="${esc(g.yt)}" target="_blank" rel="noopener">More on YouTube</a>
      <a class="btn ghost" href="${esc(g.pdf)}" target="_blank" rel="noopener">Open PDF</a>
    </div>
    ${g.video ? `<p class="small muted">${esc(g.video.label)}</p>` : ""}
  </section>`;
}

function wireGuide(el){
  const btn = el.querySelector("[data-skill]"); if (!btn) return;
  const boxes = [...el.querySelectorAll("[data-step]")];
  const upd = () => { btn.disabled = !boxes.every(b => b.checked); };
  boxes.forEach(b => b.onchange = upd);
  btn.onclick = () => { if (btn.disabled) return; markSkill(btn.dataset.skill); refreshKeep(); };
}
