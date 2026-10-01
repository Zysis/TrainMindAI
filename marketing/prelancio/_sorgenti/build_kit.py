# -*- coding: utf-8 -*-
"""
Genera il kit del pre-lancio da content.py:
  settimana-N/  reel-frame0.png, reel-end.png, reel-scena-K.png (sovrimpressioni trasparenti),
                carosello-KK.png, carosello-linkedin.pdf, storia-K.png
  _anteprime/   un foglio di anteprima per settimana
  CALENDARIO_PRELANCIO.md

Uso:  python build_kit.py        (dalla cartella _sorgenti)
Richiede: Pillow, numpy. I font del marchio sono in ./fonts (licenza OFL).
"""
import os, sys, tempfile
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from content import WEEKS, HANDLE_IG, TAGS

ROOT = os.path.dirname(HERE)                      # marketing/prelancio
TMP = tempfile.mkdtemp(prefix="lab21-kit-")       # anteprime intermedie, fuori dal kit
FONTS = os.path.join(HERE, "fonts")
LOGO_CANDIDATES = [
    os.path.join(ROOT, "..", "..", "LAB21", "logo", "lab21-wordmark-light.png"),
    os.path.join(ROOT, "..", "..", "..", "LAB21", "logo", "lab21-wordmark-light.png"),
]
LOGO = next((p for p in LOGO_CANDIDATES if os.path.exists(p)), None)

# ── palette del marchio (SISTEMA §2.3)
ACC   = (0, 201, 167)
INK   = (7, 16, 14)
GLOW  = (14, 42, 36)
WHITE = (255, 255, 255)
BODY  = (169, 189, 184)
MUTED = (90, 107, 103)
BRKT  = (34, 64, 58)

def F(name, size): return ImageFont.truetype(os.path.join(FONTS, name + ".ttf"), size)

# ────────────────────────────────────────────────────────── primitive
def background(w, h, glow_xy=(0.78, 0.12), radius=0.75):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = glow_xy[0] * w, glow_xy[1] * h
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / (radius * max(w, h))
    t = np.clip(1 - d, 0, 1) ** 2.2
    img = np.zeros((h, w, 3), np.float32)
    for i in range(3):
        img[..., i] = INK[i] + (GLOW[i] - INK[i]) * t
    return Image.fromarray(img.astype(np.uint8), "RGB")

def brackets(d, w, h, inset=48, arm=38, col=BRKT, width=3):
    for x, y, sx, sy in [(inset, inset, 1, 1), (w - inset, inset, -1, 1),
                         (inset, h - inset, 1, -1), (w - inset, h - inset, -1, -1)]:
        d.line([(x, y), (x + sx * arm, y)], fill=col, width=width)
        d.line([(x, y), (x, y + sy * arm)], fill=col, width=width)

def mono(d, xy, text, size, fill, tracking=0.2, anchor="la", maxw=1080 - 2 * 96):
    """Testo mono con spaziatura (lo stile delle etichette del reel).
    Se non sta nella larghezza utile, stringe prima la spaziatura e poi il corpo."""
    while True:
        f = F("JB-500", size)
        adv = [f.getlength(c) + tracking * size for c in text]
        total = sum(adv) - tracking * size
        if total <= maxw or size <= 20: break
        if tracking > 0.06: tracking -= 0.02
        else: size -= 2
    x, y = xy
    if anchor == "ra": x -= total
    if anchor == "ma": x -= total / 2
    for c, a in zip(text, adv):
        d.text((x, y), c, font=f, fill=fill)
        x += a
    return total

def tokens(marked):
    """'Your data *four places.*' -> [(parola, evidenziata)]"""
    out, acc = [], False
    for i, part in enumerate(marked.split("*")):
        acc = (i % 2 == 1)
        for w in part.split():
            out.append((w, acc))
    return out

def wrap(marked, font, maxw):
    lines, cur, curw = [], [], 0
    sp = font.getlength(" ")
    for w, a in tokens(marked):
        ww = font.getlength(w)
        need = ww if not cur else curw + sp + ww
        if cur and need > maxw:
            lines.append(cur); cur, curw = [(w, a)], ww
        else:
            cur.append((w, a)); curw = need
    if cur: lines.append(cur)
    return lines

def line_w(line, font):
    return sum(font.getlength(w) for w, _ in line) + font.getlength(" ") * (len(line) - 1)

def draw_lines(d, lines, font, x, y, lead, base=WHITE, acc=ACC, align="left", box_w=None):
    sp = font.getlength(" ")
    for ln in lines:
        lx = x
        if align == "center": lx = x + (box_w - line_w(ln, font)) / 2
        for w, a in ln:
            d.text((lx, y), w, font=font, fill=acc if a else base)
            lx += font.getlength(w) + sp
        y += lead
    return y

def fit(marked, face, size, maxw, max_lines):
    """Riduce il corpo finché il testo sta nel numero di righe previsto."""
    while size > 30:
        f = F(face, size)
        ln = wrap(marked, f, maxw)
        # anche una parola sola troppo lunga deve stare nella riga
        if len(ln) <= max_lines and max(line_w(l, f) for l in ln) <= maxw:
            return f, ln, size
        size -= 4
    f = F(face, size); return f, wrap(marked, f, maxw), size

def logo_img(height):
    if not LOGO: return None
    im = Image.open(LOGO).convert("RGBA")
    r = height / im.height
    return im.resize((int(im.width * r), height), Image.LANCZOS)

# ────────────────────────────────────────────────────────── formati
CW, CH = 1080, 1350     # carosello 4:5
RW, RH = 1080, 1920     # reel e storie 9:16
M = 96

def carousel_slide(s, idx, tot, n):
    img = background(CW, CH); d = ImageDraw.Draw(img)
    brackets(d, CW, CH)
    kind = s.get("kind", "content")
    mono(d, (M, M), f"LAB NOTES {n:02d}/06", 30, ACC)
    mono(d, (CW - M, M), f"{idx:02d}/{tot:02d}", 30, MUTED, anchor="ra")
    maxw = CW - 2 * M

    if kind == "end":
        lg = logo_img(78)
        top = 470
        if lg: img.paste(lg, ((CW - lg.width) // 2, top), lg)
        f, ln, sz = fit(s["title"], "SG-600", 80, maxw, 3)
        y = draw_lines(d, ln, f, M, top + 150, int(sz * 1.15), align="center", box_w=maxw)
        mono(d, (CW / 2, y + 40), s["mono"], 28, ACC, anchor="ma")
        mono(d, (CW / 2, CH - M - 30), HANDLE_IG.upper(), 24, MUTED, anchor="ma")
        return img

    big = kind == "cover"
    f, ln, sz = fit(s["title"], "SG-600", 104 if big else 88, maxw, 5 if big else 4)
    lead = int(sz * 1.15)
    bf = F("IN-400", 46)
    bl = wrap(s.get("body", ""), bf, maxw) if s.get("body") else []
    blead = int(46 * 1.42)
    block = (56 if s.get("kicker") else 0) + len(ln) * lead + (34 + len(bl) * blead if bl else 0)
    if big: block += 40
    y = max(250, int(CH * 0.47 - block / 2))
    if big:
        d.rectangle([M, y, M + 120, y + 6], fill=ACC); y += 40
    if s.get("kicker"):
        mono(d, (M, y), s["kicker"], 30, ACC); y += 56
    y = draw_lines(d, ln, f, M, y, lead)
    if bl:
        y += 34 - (lead - sz)
        draw_lines(d, [[(w, False) for w, _ in l] for l in bl], bf, M, y, blead, base=BODY)

    lg = logo_img(40)
    if lg: img.paste(lg, (M, CH - M - 40), lg)
    mono(d, (CW - M, CH - M - 28), HANDLE_IG.upper(), 26, MUTED, anchor="ra")
    return img

def reel_card(text, label="LAB21 · FROM THE LAB"):
    """Frame 0: testo già a schermo, fondo pieno, fascia 380–1540 (brief del reel)."""
    img = background(RW, RH, glow_xy=(0.8, 0.18)); d = ImageDraw.Draw(img)
    brackets(d, RW, RH, inset=60, arm=46)
    f, ln, sz = fit(text, "SG-600", 148, RW - 2 * M, 5)
    lead = int(sz * 1.15)
    h = 70 + len(ln) * lead
    y = max(380, int((380 + 1540) / 2 - h / 2))
    mono(d, (M, y), label, 46, ACC, tracking=0.12); y += 110
    draw_lines(d, ln, f, M, y, lead)
    return img

def reel_end(mono_line):
    img = background(RW, RH, glow_xy=(0.5, 0.35), radius=0.6); d = ImageDraw.Draw(img)
    brackets(d, RW, RH, inset=60, arm=46)
    lg = logo_img(130)
    y = 640
    if lg: img.paste(lg, ((RW - lg.width) // 2, y), lg)
    f, ln, sz = fit("Train more, *decide better.*", "SG-600", 112, RW - 2 * M, 3)
    y = draw_lines(d, ln, f, M, y + 230, int(sz * 1.15), align="center", box_w=RW - 2 * M)
    mono(d, (RW / 2, y + 60), mono_line, 46, ACC, tracking=0.12, anchor="ma")
    return img

def reel_overlay(big, small):
    """Sovrimpressione trasparente da mettere sopra la registrazione dello schermo."""
    ov = Image.new("RGBA", (RW, RH), (0, 0, 0, 0))
    grad = np.zeros((RH, RW, 4), np.uint8)
    y0 = 960
    a = np.clip((np.arange(RH) - y0) / (RH - y0), 0, 1) ** 0.8 * 225
    grad[..., 0], grad[..., 1], grad[..., 2] = INK
    grad[..., 3] = a[:, None].astype(np.uint8)
    ov = Image.alpha_composite(ov, Image.fromarray(grad, "RGBA"))
    d = ImageDraw.Draw(ov)
    f, ln, sz = fit(big, "SG-600", 144, RW - 2 * M, 4)
    lead = int(sz * 1.15)
    y = 1540 - len(ln) * lead
    mono(d, (M, y - 80), small, 46, ACC, tracking=0.12)
    draw_lines(d, ln, f, M, y, lead)
    return ov

def story(s):
    img = background(RW, RH, glow_xy=(0.2, 0.1)); d = ImageDraw.Draw(img)
    brackets(d, RW, RH, inset=60, arm=46)
    mono(d, (M, 250), "LAB21 · FROM THE LAB", 40, ACC, tracking=0.12)
    f, ln, sz = fit(s["title"], "SG-600", 112, RW - 2 * M, 5)
    y = draw_lines(d, ln, f, M, 360, int(sz * 1.15))
    if s.get("body"):
        bf = F("IN-400", 48)
        draw_lines(d, [[(w, False) for w, _ in l] for l in wrap(s["body"], bf, RW - 2 * M)],
                   bf, M, y + 40, 70, base=BODY)
    # con il sondaggio la fascia 1100–1600 resta vuota: ci va lo sticker di Instagram
    lg = logo_img(44)
    if lg: img.paste(lg, (M, RH - 200), lg)
    return img

def contact_sheet(paths, out, cols=6, thumb_w=260):
    ims = [Image.open(p).convert("RGB") for p in paths]
    rows = []
    for i in range(0, len(ims), cols):
        rows.append(ims[i:i + cols])
    tiles = []
    for r in rows:
        th = [im.resize((thumb_w, int(im.height * thumb_w / im.width)), Image.LANCZOS) for im in r]
        tiles.append(th)
    W = cols * (thumb_w + 16) + 16
    H = sum(max(t.height for t in r) + 16 for r in tiles) + 16
    sheet = Image.new("RGB", (W, H), (40, 44, 43))
    y = 16
    for r in tiles:
        x = 16
        for t in r:
            sheet.paste(t, (x, y)); x += thumb_w + 16
        y += max(t.height for t in r) + 16
    sheet.save(out, quality=88)

# ────────────────────────────────────────────────────────── build
def plain(t): return t.replace("*", "")

def build():
    os.makedirs(os.path.join(ROOT, "_anteprime"), exist_ok=True)
    md = []
    for w in WEEKS:
        n = w["n"]; wd = os.path.join(ROOT, f"settimana-{n}")
        os.makedirs(wd, exist_ok=True)
        made = []

        p = os.path.join(wd, "reel-frame0.png"); reel_card(w["reel"]["frame0"]).save(p); made.append(p)
        if w["reel"]["source"] == "record":
            for k, (big, small) in enumerate(w["reel"]["overlays"], 1):
                p = os.path.join(wd, f"reel-scena-{k}.png"); reel_overlay(big, small).save(p)
                # anteprima su fondo scuro, solo per il foglio: va in una cartella temporanea
                prev = background(RW, RH).convert("RGBA"); prev.alpha_composite(Image.open(p))
                pp = os.path.join(TMP, f"w{n}-scena-{k}.png"); prev.convert("RGB").save(pp); made.append(pp)
        p = os.path.join(wd, "reel-end.png"); reel_end(w["reel"]["end_mono"]).save(p); made.append(p)

        slides = w["carousel"]["slides"]; cps = []
        for i, s in enumerate(slides, 1):
            p = os.path.join(wd, f"carosello-{i:02d}.png")
            carousel_slide(s, i, len(slides), n).save(p); cps.append(p)
        made += cps
        pdf = [Image.open(x).convert("RGB") for x in cps]
        pdf[0].save(os.path.join(wd, "carosello-linkedin.pdf"), save_all=True, append_images=pdf[1:], resolution=150)

        for k, s in enumerate(w["stories"], 1):
            p = os.path.join(wd, f"storia-{k}.png"); story(s).save(p); made.append(p)

        contact_sheet(made, os.path.join(ROOT, "_anteprime", f"settimana-{n}.jpg"))
        md.append(week_md(w))
    return md

# ────────────────────────────────────────────────────────── calendario
def quote(t): return "\n".join("> " + l if l else ">" for l in t.split("\n"))

def week_md(w):
    n, r, c = w["n"], w["reel"], w["carousel"]
    o = [f"## Settimana {n} — {w['theme']}  ·  da lunedì {w['start']}\n",
         f"*{w['why']}*\n",
         f"Anteprima di tutta la settimana: `_anteprime/settimana-{n}.jpg`\n",
         f"### Lunedì — Reel Instagram\n",
         f"**Frame 0** (`settimana-{n}/reel-frame0.png`, tenerlo circa 2 s, il tempo di leggerlo): **{plain(r['frame0'])}**  \n"
         "Quando carichi il reel, scegli questo cartello come **copertina**: è quello che si vede nella griglia del profilo.\n"]
    if r["source"] == "recut":
        o.append(f"**Già montato:** `{r['ready']}` — 12 secondi, 1080×1920, pronto da pubblicare. "
                 "Nasce dal reel già pubblicato, senza riprese nuove; l'audio è quello originale, "
                 "con il colpo finale che cade sull'ingresso del cartello di chiusura.\n")
        o.append("| Tempo | Materiale | Testo a schermo |\n|---|---|---|")
        for t, src, txt in r["recut"]: o.append(f"| {t} | {src} | {txt} |")
        o.append("")
    else:
        o.append(f"**Da registrare** (schermo, verticale, con i dati demo): {r['record_what']}\n")
        o.append("| Scena | Sovrimpressione (PNG trasparente) | Testo grande | Etichetta |\n|---|---|---|---|")
        for k, (big, small) in enumerate(r["overlays"], 1):
            o.append(f"| {k} (~2,5 s) | `settimana-{n}/reel-scena-{k}.png` | {plain(big)} | {small} |")
        o.append(f"| fine (2,5 s) | `settimana-{n}/reel-end.png` | Train more, decide better. | {r['end_mono']} |\n")
    if r["source"] == "recut":
        o.append(f"Chiusura: `reel-end.png` con l'etichetta *{r['end_mono']}*.\n")
    o.append("**Didascalia:**\n"); o.append(quote(r["caption"] + "\n\n" + TAGS) + "\n")

    o.append(f"### Mercoledì — Carosello Instagram · *Lab notes {n:02d} — {c['title']}*\n")
    o.append(f"File: `settimana-{n}/carosello-01.png` … `carosello-{len(c['slides']):02d}.png`\n")
    o.append("| # | Testo della slide |\n|---|---|")
    for i, s in enumerate(c["slides"], 1):
        t = plain(s["title"])
        if s.get("kicker"): t = f"`{s['kicker']}` · " + t
        if s.get("body"): t += f" — *{s['body']}*"
        if s.get("mono"): t += f" — `{s['mono']}`"
        o.append(f"| {i} | {t} |")
    o.append("\n**Didascalia:**\n"); o.append(quote(c["caption"] + "\n\n" + TAGS) + "\n")

    o.append("### Giovedì — Post LinkedIn (profilo personale)\n")
    o.append(f"Allegato: `settimana-{n}/carosello-linkedin.pdf` come **documento** (il carosello del mercoledì). "
             "Link al sito nel **primo commento**, mai nel testo.\n")
    o.append(quote(w["linkedin"]) + "\n")

    o.append("### Venerdì — Storie Instagram\n")
    o.append("| # | File | Testo | Sticker |\n|---|---|---|---|")
    for k, s in enumerate(w["stories"], 1):
        st = ""
        if s.get("poll"): st = "**Sondaggio:** " + " / ".join(s["poll"]) + " — nella fascia bassa lasciata vuota"
        elif k == 1 and n > 1: st = "Dopo questa, **condividi i risultati** del sondaggio della settimana prima"
        o.append(f"| {k} | `settimana-{n}/storia-{k}.png` | {plain(s['title'])}"
                 + (f" — *{s['body']}*" if s.get("body") else "") + f" | {st} |")
    o.append("\n---\n")
    return "\n".join(o)

if __name__ == "__main__":
    sections = build()
    head = open(os.path.join(HERE, "intro.md"), encoding="utf-8").read()
    tail = open(os.path.join(HERE, "coda.md"), encoding="utf-8").read()
    with open(os.path.join(ROOT, "CALENDARIO_PRELANCIO.md"), "w", encoding="utf-8") as fh:
        fh.write(head.rstrip() + "\n\n---\n\n" + "\n".join(sections) + "\n" + tail)
    print("kit generato in", ROOT)
