"""Builds the Fishy Friends rig and bait guides from one source:
   - guides/<id>.pdf  one-page printable picture guides (reportlab)
   - js/guides.js     the same guides for the in-app pages (diagrams drawn as SVG in the browser)
Run from the repo root:  python3 tools/build_guides.py
Diagrams use a tiny drawing language in a 320 x 200 box (y grows downwards)."""
import json, os, urllib.parse
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import simpleSplit

INK, SEA, SAND, WATER, MUTED = "#10262B", "#13707A", "#B9752A", "#DCEDEE", "#56696D"
LINE = "#2E3A8C"

def hook(x, y, s=1.0, col=INK):
    """A J-hook: eye at (x,y), shank down, bend, point back up."""
    k = lambda a, b: (x + a * s, y + b * s)
    return [("circle", *k(0, 0), 3 * s, {"fill": "none", "stroke": col, "w": 2}),
            ("path", [("M", *k(0, 3)), ("L", *k(0, 26)), ("C", *k(0, 38), *k(14, 38), *k(14, 26)), ("L", *k(14, 20))], {"stroke": col, "w": 2.4}),
            ("poly", [k(14, 18), k(11, 24), k(17, 24)], {"fill": col})]

def swivel(x, y, col=INK):
    return [("circle", x - 6, y, 4, {"fill": "none", "stroke": col, "w": 2}), ("rect", x - 2, y - 3, 4, 6, {"fill": col}),
            ("circle", x + 6, y, 4, {"fill": "none", "stroke": col, "w": 2})]

def label(x, y, t, anchor="middle", size=10, col=MUTED, bold=False):
    return ("text", x, y, t, {"size": size, "anchor": anchor, "c": col, "bold": bold})

def prawn(x, y):
    return [("path", [("M", x, y), ("C", x + 10, y - 12, x + 30, y - 10, x + 34, y + 2), ("C", x + 26, y + 8, x + 10, y + 8, x, y)], {"fill": "#F2A27A", "stroke": INK, "w": 1.5}),
            ("line", x + 30, y - 4, x + 44, y - 12, {"c": INK, "w": 1}), ("line", x + 30, y - 2, x + 46, y - 4, {"c": INK, "w": 1})]

def water(y=40):
    return [("rect", 0, y, 320, 200 - y, {"fill": WATER}),
            ("path", [("M", 0, y), ("C", 20, y - 5, 40, y + 5, 60, y), ("C", 80, y - 5, 100, y + 5, 120, y), ("C", 140, y - 5, 160, y + 5, 180, y),
                      ("C", 200, y - 5, 220, y + 5, 240, y), ("C", 260, y - 5, 280, y + 5, 300, y), ("L", 320, y)], {"stroke": SEA, "w": 1.5})]

def sand(y=185):
    return [("rect", 0, y, 320, 200 - y, {"fill": "#EAD9B5"})]

GUIDES = [
  {"id": "running-sinker", "title": "Running sinker rig", "for": ["bream", "flathead", "whiting", "snapper"],
   "intro": "The best all-round bait rig. The sinker slides, so a fish can take the bait without feeling the weight.",
   "you_need": "Small ball sinker, swivel, 50 cm of leader line, size 4 to 1 hook, bait.",
   "steps": ["Thread the ball sinker onto your main line.", "Tie the main line to one end of the swivel (improved clinch knot).",
             "Tie about 50 cm of leader to the other end of the swivel.", "Tie the hook to the end of the leader.",
             "Hide the hook point inside the bait, cast out and let it sink to the bottom.", "Keep the line just tight. When you feel taps, lift the rod firmly."],
   "kid_tip": "Watch the rod tip. Little taps mean a fish is nibbling. Wait for a strong pull!",
   "safety": "Point the rod tip away from people when you cast, and look behind you first.",
   "video": {"label": "Running rigs guide (Black Magic Tackle)", "url": "https://blackmagictackle.com/fishing-guides/running-rigs"},
   "yt": "how to tie a running sinker rig for bream",
   "draw": water(40) + sand(185) + [
       ("line", 0, 20, 140, 120, {"c": LINE, "w": 2}), label(20, 14, "Main line", "start"),
       ("circle", 120, 106, 9, {"fill": "#7F8C8D", "stroke": INK, "w": 1.5}), label(108, 128, "Ball sinker (slides)", "end", 9),
       ] + swivel(152, 128) + [label(152, 150, "Swivel", "middle", 9),
       ("line", 158, 128, 250, 150, {"c": SEA, "w": 1.6, "dash": True}), label(214, 128, "Leader 50 cm", "middle", 9, SEA),
       ] + hook(252, 148, 1.0) + prawn(262, 170) + [label(262, 116, "Hook + bait", "middle", 9)]},

  {"id": "paternoster", "title": "Paternoster rig", "for": ["leatherjacket", "trevally", "bream", "snapper"],
   "intro": "Two hooks above a sinker. Great off wharves and rocks because the baits sit up off the bottom, away from snags.",
   "you_need": "Bomb sinker, 1 m of leader line, two small long-shank hooks (size 8 to 4), bait.",
   "steps": ["Tie a dropper loop about 30 cm from the end of the leader, and another 30 cm above it.", "Tie the bomb sinker to the very end of the leader.",
             "Thread a hook onto each loop (pass the loop through the hook eye and over the hook).", "Tie the top of the leader to your main line with a swivel.",
             "Lower it straight down beside the pylons until the sinker touches bottom, then wind in a little.", "Strike quickly. Leatherjackets are fast nibblers!"],
   "kid_tip": "Drop it straight down next to the wharf. No big cast needed!",
   "safety": "Hold onto the rail and never lean over the edge of a wharf.",
   "video": {"label": "How to tie a paternoster rig with Paul Worsteling (Club Marine)", "url": "https://www.clubmarine.com.au/explore-boating/videos/how-to-tie-a-paternoster-rig.html"},
   "yt": "how to tie a paternoster rig dropper loop",
   "draw": water(30) + sand(185) + [
       ("rect", 30, 0, 26, 200, {"fill": "#9AA7AA"}), label(43, 196, "Pylon", "middle", 9, "#FFFFFF"),
       ("line", 160, 0, 160, 165, {"c": LINE, "w": 2}),
       ] + swivel(160, 46) + [label(178, 50, "Swivel", "start", 9),
       ("path", [("M", 160, 80), ("C", 176, 76, 190, 84, 160, 90)], {"stroke": LINE, "w": 2}),
       ] + hook(186, 84, 0.8) + [label(212, 98, "Dropper loop + hook", "start", 9),
       ("path", [("M", 160, 120), ("C", 176, 116, 190, 124, 160, 130)], {"stroke": LINE, "w": 2}),
       ] + hook(186, 124, 0.8) + [
       ("poly", [(152, 165), (168, 165), (164, 184), (156, 184)], {"fill": "#7F8C8D", "stroke": INK, "w": 1.5}),
       label(178, 178, "Bomb sinker", "start", 9)]},

  {"id": "unweighted", "title": "Unweighted bait rig", "for": ["bream", "mullet", "luderick", "trevally", "snapper"],
   "intro": "The simplest rig there is: just a hook and bait. It drifts down slowly and naturally, which fussy fish love.",
   "you_need": "Small hook (size 10 to 4), light line, bread or a small piece of prawn. Optional: a small float.",
   "steps": ["Tie the hook straight onto the end of your line.", "Squeeze a small piece of bread or prawn onto the hook so the point is covered.",
             "Flick it out gently. There's no sinker, so it doesn't need to go far.", "Let it sink slowly. Throw a few crumbs in the water nearby to attract fish.",
             "For luderick or mullet, clip on a small float so you can see bites.", "When the float dips or the line moves off, lift the rod."],
   "kid_tip": "Best rig for first-timers. Bread and a tiny hook catch mullet almost anywhere!",
   "safety": "Keep the hook covered or in a cork when you're not fishing.",
   "video": None, "yt": "unweighted bait fishing for bream beginners",
   "draw": water(50) + [
       ("path", [("M", 10, 10), ("C", 80, 20, 140, 40, 170, 60)], {"stroke": LINE, "w": 2}), label(12, 26, "Line", "start"),
       ("ellipse", 172, 56, 7, 11, {"fill": "#E5533D", "stroke": INK, "w": 1.5}), label(190, 42, "Optional float", "start", 9),
       ("line", 172, 67, 190, 130, {"c": LINE, "w": 1.6}),
       ] + hook(190, 130, 1.0) + [("circle", 202, 160, 9, {"fill": "#F6E3B4", "stroke": INK, "w": 1.5}), label(220, 164, "Bread or prawn", "start", 9),
       ("circle", 120, 90, 2.5, {"fill": "#F6E3B4"}), ("circle", 130, 110, 2.5, {"fill": "#F6E3B4"}), ("circle", 112, 126, 2.5, {"fill": "#F6E3B4"}),
       label(80, 150, "Crumbs attract fish", "middle", 9)]},

  {"id": "soft-plastic", "title": "Soft plastic on a jighead", "for": ["flathead", "bream", "kingfish", "tailor"],
   "intro": "A rubbery lure on a weighted hook. No bait needed. Hop it along the bottom and flathead can't resist.",
   "you_need": "Jighead (1/8 to 1/4 oz, hook size 1/0 to 2/0), 3 to 4 inch soft plastic, leader line.",
   "steps": ["Tie the jighead to your leader with a uni knot.", "Push the hook point into the very front of the plastic.",
             "Slide the plastic up the hook, then push the point out through the top so the lure sits straight.", "Cast out and count while it sinks until the line goes slack (it's on the bottom).",
             "Give the rod two sharp lifts, then let the lure sink back down on a tight line.", "Most bites come as it sinks. If the line twitches, strike!"],
   "kid_tip": "Lift, lift, drop. Lift, lift, drop. Pretend your lure is a little fish hopping along.",
   "safety": "Jigheads are sharp and heavy. Cast overhead, never sideways near people.",
   "video": {"label": "How to catch flathead on soft plastics (Shimano)", "url": "https://fish.shimano.com/en-AU/content/c/Articles/how-to/how-to-catch-flathead-on-soft-plastics0.html"},
   "yt": "how to rig a soft plastic on a jighead",
   "draw": water(20) + sand(175) + [
       ("path", [("M", 20, 170), ("C", 40, 120, 60, 120, 80, 170), ("C", 100, 120, 120, 120, 140, 170), ("C", 160, 120, 180, 120, 200, 170)], {"stroke": SAND, "w": 1.6, "dash": True}),
       label(110, 112, "Lift, lift... drop", "middle", 10, SAND, True),
       ("circle", 240, 150, 9, {"fill": "#E0A21B", "stroke": INK, "w": 1.5}),
       ("path", [("M", 248, 146), ("C", 270, 140, 290, 146, 304, 140), ("C", 296, 150, 280, 156, 248, 156)], {"fill": "#3BB273", "stroke": INK, "w": 1.5}),
       ("path", [("M", 266, 144), ("L", 266, 134)], {"stroke": INK, "w": 2}),
       label(240, 132, "Jighead", "middle", 9), label(290, 172, "Soft plastic", "middle", 9),
       ("line", 230, 146, 160, 20, {"c": LINE, "w": 1.6}), label(205, 70, "Leader", "start", 9)]},

  {"id": "knots", "title": "Two knots to know", "for": ["bream", "flathead", "tailor", "kingfish", "whiting"],
   "intro": "Almost every rig uses one of these. Practise at home with thick string first.",
   "you_need": "Line, a hook or swivel, and a bit of spit or water to wet the knot.",
   "steps": ["Improved clinch knot: thread the line through the hook eye and pull 15 cm through.", "Twist the end around the main line 5 to 7 times.",
             "Push the end back through the small loop next to the eye, then through the big loop you just made.", "Wet the knot, pull the main line tight and trim the end.",
             "Uni knot: thread the line through the eye, lay the end back alongside the line to make a loop, and wrap the end around both lines and through the loop 5 times.",
             "Wet it, pull the end to snug the wraps, then pull the main line to slide the knot down to the eye. Trim."],
   "kid_tip": "Always wet the knot before pulling tight. Dry knots get hot and weak.",
   "safety": "Use nail clippers, not your teeth, to trim line.",
   "video": {"label": "Improved clinch knot with Barry Stokes (Mercury)", "url": "https://www.mercurymarine.com/sp/en/lifestyle/dockline/how-to-tie-the-improved-clinch-knot-with-barry-stokes"},
   "yt": "how to tie a uni knot fishing",
   "draw": [label(80, 18, "Improved clinch knot", "middle", 11, INK, True), label(240, 18, "Uni knot", "middle", 11, INK, True),
       ("line", 160, 30, 160, 190, {"c": "#D3E0DF", "w": 1})] +
       hook(110, 70, 2.0) + [
       ("line", 10, 70, 100, 70, {"c": LINE, "w": 2}),
       ] + [("ellipse", 30 + i * 11, 70, 5, 8, {"fill": "none", "stroke": LINE, "w": 1.6}) for i in range(6)] + [
       ("path", [("M", 104, 72), ("C", 100, 92, 40, 92, 30, 78)], {"stroke": LINE, "w": 1.6}), label(60, 110, "5 to 7 twists", "middle", 9),
       ] + hook(270, 70, 2.0) + [
       ("line", 170, 70, 260, 70, {"c": LINE, "w": 2}),
       ("path", [("M", 266, 72), ("C", 240, 100, 200, 100, 190, 74)], {"stroke": LINE, "w": 1.6}),
       ] + [("ellipse", 200 + i * 10, 76, 5, 9, {"fill": "none", "stroke": LINE, "w": 1.6}) for i in range(5)] + [
       label(215, 130, "5 wraps through the loop", "middle", 9), label(160, 186, "Wet it, pull tight, trim the end", "middle", 10, SEA, True)]},

  {"id": "bait", "title": "Bait guide", "for": ["bream", "flathead", "whiting", "mullet", "luderick", "snapper"],
   "intro": "Fresh bait catches more fish. Match the bait to the fish you want.",
   "you_need": "A small esky or bucket to keep bait cool, a bait board and a knife (grown-ups only).",
   "steps": ["Prawns (raw, peeled): bream, whiting, flathead, trevally. Thread a whole small prawn onto the hook.",
             "Squid strips: flathead, snapper, tailor, leatherjacket. Cut thin strips about finger length.",
             "Pippies or worms: whiting and bream on sand. Soft, so cover the hook gently.",
             "Bread or dough: mullet, bream and luderick. Pinch a pea-sized piece onto a tiny hook.",
             "Green weed or cabbage: luderick. Wrap a small strand around the hook under a float.",
             "Pilchards: tailor, kingfish and flathead. Use half a pilchard on a bigger hook."],
   "kid_tip": "Small bait, small hook. Most harbour fish have little mouths!",
   "safety": "Keep bait out of the sun and take leftovers home. Don't feed birds.",
   "video": None, "yt": "best baits for bream flathead whiting australia",
   "draw": prawn(20, 60) + [label(40, 90, "Prawn", "middle", 10, INK, True),
       ("rect", 110, 50, 60, 14, {"fill": "#F7E9F0", "stroke": INK, "w": 1.5}), label(140, 90, "Squid strip", "middle", 10, INK, True),
       ("ellipse", 240, 56, 22, 12, {"fill": "#F6E3B4", "stroke": INK, "w": 1.5}), ("path", [("M", 222, 56), ("C", 232, 50, 248, 50, 258, 56)], {"stroke": INK, "w": 1}),
       label(240, 90, "Pippi", "middle", 10, INK, True),
       ("circle", 40, 140, 12, {"fill": "#FFF7E0", "stroke": INK, "w": 1.5}), label(40, 176, "Bread", "middle", 10, INK, True),
       ("path", [("M", 110, 140), ("C", 125, 120, 140, 160, 155, 135), ("C", 160, 128, 168, 150, 172, 140)], {"stroke": "#3BB273", "w": 4}),
       label(140, 176, "Green weed", "middle", 10, INK, True),
       ("path", [("M", 210, 140), ("C", 230, 126, 260, 126, 270, 140), ("C", 260, 152, 230, 152, 210, 140)], {"fill": "#B8C4C6", "stroke": INK, "w": 1.5}),
       ("poly", [(270, 140), (280, 132), (280, 148)], {"fill": "#B8C4C6", "stroke": INK, "w": 1.5}), label(245, 176, "Pilchard", "middle", 10, INK, True)]},

  {"id": "squid-jig", "title": "Squid jigging", "for": ["squid"],
   "intro": "Squid hunt by sight, so calm, clear water is best, especially at dawn, dusk and under wharf lights at night.",
   "you_need": "Size 2.0 to 3.0 squid jig, light rod, bucket for the squid (they squirt ink!).",
   "steps": ["Tie the jig straight to your line with an improved clinch knot or a small snap.", "Cast out near weed beds or the edge of wharf lights.",
             "Count to 10 while it sinks (longer in deeper water).", "Give the rod two gentle lifts, then let the jig sink again on a slack line.",
             "Squid grab the jig as it sinks. When it feels heavy, wind smoothly. Don't jerk.", "Lift the squid out pointing away from you and drop it into the bucket."],
   "kid_tip": "Squid squirt ink when they're lifted out. Point them away from your clothes!",
   "safety": "Squid jig hooks are very sharp: hold the jig by its body, not the spikes.",
   "video": None, "yt": "how to catch squid from a wharf squid jig beginners",
   "draw": water(20) + sand(185) + [
       ("path", [("M", 30, 185), ("C", 26, 160, 36, 150, 30, 130), ("M", 44, 185), ("C", 48, 165, 40, 150, 46, 138), ("M", 58, 185), ("C", 54, 168, 62, 156, 58, 144)], {"stroke": "#3BB273", "w": 3}),
       label(46, 120, "Weed bed", "middle", 9),
       ("path", [("M", 150, 30), ("L", 150, 110)], {"stroke": SAND, "w": 1.6, "dash": True}), label(158, 70, "Count to 10 as it sinks", "start", 9, SAND, True),
       ("path", [("M", 140, 120), ("C", 150, 100, 170, 100, 180, 120)], {"stroke": SAND, "w": 1.6, "dash": True}), label(178, 104, "Two gentle lifts", "start", 9, SAND, True),
       ("path", [("M", 200, 130), ("C", 220, 122, 250, 122, 262, 130), ("C", 250, 138, 220, 138, 200, 130)], {"fill": "#E5533D", "stroke": INK, "w": 1.5}),
       ("line", 262, 126, 270, 120, {"c": INK, "w": 1.5}), ("line", 262, 130, 272, 130, {"c": INK, "w": 1.5}), ("line", 262, 134, 270, 140, {"c": INK, "w": 1.5}),
       label(232, 152, "Squid jig", "middle", 9)]},

  {"id": "release", "title": "Handling and releasing fish", "for": ["bream", "flathead", "tailor", "kingfish", "snapper", "whiting"],
   "intro": "Undersize fish, oversize flathead and everything caught west of the Harbour Bridge goes back. Do it gently and quickly.",
   "you_need": "Wet hands or a wet towel, long-nose pliers, a ruler or measuring sticker on your rod.",
   "steps": ["Wet your hands before touching the fish. Dry hands rub off their protective slime.", "Hold the fish gently: one hand under the belly, one near the tail. Never squeeze.",
             "Keep it in or over the water as much as you can. Lay it on a wet surface to measure, never on hot concrete.",
             "Use pliers to back the hook out. If it's swallowed deep, cut the line close to the mouth instead.",
             "Hold it upright in the water, facing into the current, until it swims off by itself.", "Watch out for spines (flathead, leatherjacket) and teeth (tailor, kingfish)."],
   "kid_tip": "Be quick and gentle. Count to 30: the fish should be back in the water before you finish!",
   "safety": "Flathead have sharp spikes on the sides of their head. Hold them from behind with a wet towel.",
   "video": {"label": "Catch and release tips (NSW DPI)", "url": "https://www.dpi.nsw.gov.au/dpi/fishing/recreational-fishing/responsible-fishing/catch-and-release"},
   "yt": "how to release a fish safely",
   "draw": water(120) + [
       ("ellipse", 160, 90, 70, 26, {"fill": "#B8C4C6", "stroke": INK, "w": 2}), ("poly", [(228, 90), (260, 66), (260, 114)], {"fill": "#B8C4C6", "stroke": INK, "w": 2}),
       ("circle", 108, 84, 4, {"fill": INK}),
       ("path", [("M", 120, 130), ("C", 130, 112, 170, 112, 180, 130)], {"fill": "#F2C9A6", "stroke": INK, "w": 1.5}), label(150, 150, "Support the belly", "middle", 9, INK, True),
       ("path", [("M", 215, 128), ("C", 220, 108, 245, 108, 248, 126)], {"fill": "#F2C9A6", "stroke": INK, "w": 1.5}), label(240, 150, "Hold near the tail", "middle", 9, INK, True),
       label(160, 40, "Wet hands, gentle grip, back in quickly", "middle", 11, SEA, True),
       ("path", [("M", 40, 175), ("L", 80, 175)], {"stroke": SEA, "w": 2}), ("poly", [(80, 170), (90, 175), (80, 180)], {"fill": SEA}), label(65, 192, "Face into the current", "middle", 9)]},
]

FISH = {"bream": "Bream", "flathead": "Flathead", "leatherjacket": "Leatherjacket", "whiting": "Whiting", "tailor": "Tailor", "luderick": "Luderick",
        "squid": "Squid", "snapper": "Snapper", "trevally": "Trevally", "mullet": "Mullet", "kingfish": "Kingfish"}
SITE = "j-fishy-friends.github.io"

# ---------- PDF ----------
def pdf_draw(c, items, ox, oy, s):
    def P(x, y): return ox + x * s, oy - y * s
    for it in items:
        kind = it[0]; st = it[-1] if isinstance(it[-1], dict) else {}
        stroke = st.get("stroke") or st.get("c"); fill = st.get("fill")
        c.setLineWidth(st.get("w", 1.5) * s * 0.9)
        c.setDash([4 * s, 3 * s] if st.get("dash") else [])
        if stroke: c.setStrokeColor(HexColor(stroke))
        if fill and fill != "none": c.setFillColor(HexColor(fill))
        f = 1 if fill and fill != "none" else 0
        sk = 1 if stroke else 0
        if kind == "line":
            c.setStrokeColor(HexColor(st.get("c", INK))); x1, y1 = P(it[1], it[2]); x2, y2 = P(it[3], it[4]); c.line(x1, y1, x2, y2)
        elif kind == "circle":
            x, y = P(it[1], it[2]); c.circle(x, y, it[3] * s, stroke=sk, fill=f)
        elif kind == "ellipse":
            x, y = P(it[1], it[2]); rx, ry = it[3] * s, it[4] * s; c.ellipse(x - rx, y - ry, x + rx, y + ry, stroke=sk, fill=f)
        elif kind == "rect":
            x, y = P(it[1], it[2] + it[4]); c.rect(x, y, it[3] * s, it[4] * s, stroke=sk, fill=f)
        elif kind == "poly":
            p = c.beginPath(); pts = it[1]; p.moveTo(*P(*pts[0]))
            for q in pts[1:]: p.lineTo(*P(*q))
            p.close(); c.drawPath(p, stroke=sk, fill=f)
        elif kind == "path":
            p = c.beginPath()
            for seg in it[1]:
                if seg[0] == "M": p.moveTo(*P(seg[1], seg[2]))
                elif seg[0] == "L": p.lineTo(*P(seg[1], seg[2]))
                elif seg[0] == "C": p.curveTo(*P(seg[1], seg[2]), *P(seg[3], seg[4]), *P(seg[5], seg[6]))
            c.drawPath(p, stroke=1, fill=f)
        elif kind == "text":
            c.setDash([]); c.setFillColor(HexColor(st.get("c", MUTED)))
            c.setFont("Helvetica-Bold" if st.get("bold") else "Helvetica", st.get("size", 10) * s * 0.95)
            x, y = P(it[1], it[2]); a = st.get("anchor", "middle")
            (c.drawCentredString if a == "middle" else c.drawRightString if a == "end" else c.drawString)(x, y, it[3])
    c.setDash([])

def yt_url(q): return "https://www.youtube.com/results?search_query=" + urllib.parse.quote_plus(q)

def build_pdf(g, path):
    W, H = A4; M = 40
    c = canvas.Canvas(path, pagesize=A4)
    c.setTitle(g["title"] + " | Fishy Friends"); c.setAuthor("Fishy Friends")
    c.setFillColor(HexColor(SEA)); c.rect(0, H - 92, W, 92, stroke=0, fill=1)
    c.setFillColor(HexColor("#FFFFFF")); c.setFont("Helvetica-Bold", 11); c.drawString(M, H - 34, "FISHY FRIENDS GUIDE")
    c.setFont("Helvetica-Bold", 26); c.drawString(M, H - 66, g["title"])
    c.setFont("Helvetica", 10.5); c.drawString(M, H - 84, "Good for: " + ", ".join(FISH[f] for f in g["for"]))
    y = H - 112
    c.setFillColor(HexColor(INK)); c.setFont("Helvetica", 11.5)
    for ln in simpleSplit(g["intro"], "Helvetica", 11.5, W - 2 * M): c.drawString(M, y, ln); y -= 15
    y -= 6
    bw = W - 2 * M; s = bw / 320; bh = 200 * s
    c.setStrokeColor(HexColor("#D3E0DF")); c.setLineWidth(1); c.setFillColor(HexColor("#FFFFFF")); c.roundRect(M, y - bh, bw, bh, 8, stroke=1, fill=1)
    c.saveState(); p = c.beginPath(); p.roundRect(M, y - bh, bw, bh, 8); c.clipPath(p, stroke=0, fill=0)
    pdf_draw(c, g["draw"], M, y, s); c.restoreState()
    y -= bh + 18
    c.setFillColor(HexColor(SEA)); c.setFont("Helvetica-Bold", 10.5); c.drawString(M, y, "YOU NEED"); y -= 14
    c.setFillColor(HexColor(INK)); c.setFont("Helvetica", 10.5)
    for ln in simpleSplit(g["you_need"], "Helvetica", 10.5, W - 2 * M): c.drawString(M, y, ln); y -= 13
    y -= 6; c.setFillColor(HexColor(SEA)); c.setFont("Helvetica-Bold", 10.5); c.drawString(M, y, "STEPS"); y -= 15
    for i, stp in enumerate(g["steps"], 1):
        c.setFillColor(HexColor(SEA)); c.circle(M + 8, y + 3.5, 8, stroke=0, fill=1)
        c.setFillColor(HexColor("#FFFFFF")); c.setFont("Helvetica-Bold", 9.5); c.drawCentredString(M + 8, y + 0.5, str(i))
        c.setFillColor(HexColor(INK)); c.setFont("Helvetica", 10.5)
        for j, ln in enumerate(simpleSplit(stp, "Helvetica", 10.5, W - 2 * M - 26)): c.drawString(M + 24, y, ln); y -= 13
        y -= 5
    y -= 4
    for head, text, bg, col in (("KID TIP", g["kid_tip"], "#FFF1C9", "#8A5A00"), ("STAY SAFE", g["safety"], "#F8E3DE", "#A23D25")):
        lines = simpleSplit(text, "Helvetica", 10.5, W - 2 * M - 110); bh2 = max(28, 13 * len(lines) + 14)
        c.setFillColor(HexColor(bg)); c.roundRect(M, y - bh2 + 10, W - 2 * M, bh2, 6, stroke=0, fill=1)
        c.setFillColor(HexColor(col)); c.setFont("Helvetica-Bold", 10); c.drawString(M + 10, y - 4, head)
        c.setFillColor(HexColor(INK)); c.setFont("Helvetica", 10.5)
        yy = y - 4
        for ln in lines: c.drawString(M + 90, yy, ln); yy -= 13
        y -= bh2 + 8
    fy = 52
    c.setStrokeColor(HexColor("#D3E0DF")); c.line(M, fy + 22, W - M, fy + 22)
    c.setFont("Helvetica-Bold", 10); c.setFillColor(HexColor(SEA))
    if g["video"]:
        t = "Watch: " + g["video"]["label"]; c.drawString(M, fy + 6, t); c.linkURL(g["video"]["url"], (M, fy + 2, M + c.stringWidth(t, "Helvetica-Bold", 10), fy + 16))
        fy -= 14
    t = "More videos: search YouTube for \"" + g["yt"] + "\""; c.setFont("Helvetica", 10); c.drawString(M, fy + 6, t)
    c.linkURL(yt_url(g["yt"]), (M, fy + 2, M + c.stringWidth(t, "Helvetica", 10), fy + 16))
    c.setFillColor(HexColor(MUTED)); c.setFont("Helvetica", 9)
    c.drawString(M, 24, "Fishy Friends  |  " + SITE + "  |  Check NSW size and bag limits before keeping any fish.")
    c.showPage(); c.save()

# ---------- JS for the app ----------
def js_items(items):
    out = []
    for it in items:
        it = list(it)
        if it[0] in ("poly",): it[1] = [list(p) for p in it[1]]
        if it[0] == "path": it[1] = [list(s) for s in it[1]]
        out.append(it)
    return out

if __name__ == "__main__":
    os.makedirs("guides", exist_ok=True)
    data = []
    for g in GUIDES:
        build_pdf(g, f"guides/{g['id']}.pdf")
        d = {k: g[k] for k in ("id", "title", "for", "intro", "you_need", "steps", "kid_tip", "safety", "video")}
        d["yt"] = yt_url(g["yt"]); d["draw"] = js_items(g["draw"]); d["pdf"] = f"guides/{g['id']}.pdf"
        data.append(d)
    with open("js/guides.js", "w") as f:
        f.write("/* Generated by tools/build_guides.py. Edit that file, not this one. */\nwindow.GUIDES=" + json.dumps(data, separators=(",", ":")) + ";\n")
    print("built", len(data), "guides")
