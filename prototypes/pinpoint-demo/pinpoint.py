"""PROTOTYPE — throwaway. Pinpoint v2 core loop: attack -> find clues -> cheapest edit -> attack again.

Attacker: GeoCLIP (open model, runs locally). The real product adds VLM and web-search attackers.
"""
import math
from dataclasses import dataclass, field

import numpy as np
import torch
from PIL import Image, ImageDraw, ImageFilter

DEVICE = "mps" if torch.backends.mps.is_available() else "cpu"
_model = None
_loc_feats = None
_lama = None


def _load():
    global _model, _loc_feats
    if _model is None:
        from geoclip import GeoCLIP

        _model = GeoCLIP().to(DEVICE).eval()
        with torch.no_grad():
            g = _model.gps_gallery.to(DEVICE)
            feats = torch.cat([_model.location_encoder(g[i : i + 8192]) for i in range(0, len(g), 8192)])
            _loc_feats = torch.nn.functional.normalize(feats, dim=1)
    return _model, _loc_feats


def _lama_model():
    global _lama
    if _lama is None:
        from simple_lama_inpainting import SimpleLama
        from simple_lama_inpainting.models.model import LAMA_MODEL_URL
        from simple_lama_inpainting.utils import download_model

        _lama = SimpleLama.__new__(SimpleLama)  # the weights were saved on CUDA; load them on CPU
        _lama.model = torch.jit.load(download_model(LAMA_MODEL_URL), map_location="cpu").eval()
        _lama.device = torch.device("cpu")
    return _lama


def haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return 6371 * 2 * np.arcsin(np.sqrt(a))


@torch.no_grad()
def attack(images):
    """Return a (n, gallery) probability matrix over 100K GPS points for each PIL image."""
    model, loc = _load()
    out = []
    for i in range(0, len(images), 32):
        x = model.image_encoder.preprocess_image([im.convert("RGB") for im in images[i : i + 32]]).to(DEVICE)
        f = torch.nn.functional.normalize(model.image_encoder(x), dim=1)
        out.append((model.logit_scale.exp() * f @ loc.T).softmax(dim=-1).cpu())
    return torch.cat(out).numpy()


def gallery():
    m, _ = _load()
    return m.gps_gallery.cpu().numpy()


@dataclass
class Guess:
    lat: float
    lon: float
    km_from_truth: float
    mass_in_radius: float  # attacker's probability that the photo is inside the privacy radius


def summarize(probs, truth, radius_km):
    gps = gallery()
    d = haversine_km(truth[0], truth[1], gps[:, 0], gps[:, 1])
    inside = d <= radius_km
    res = []
    for p in probs:
        top = int(p.argmax())
        res.append(Guess(float(gps[top, 0]), float(gps[top, 1]), float(d[top]), float(p[inside].sum())))
    return res


def clue_map(img, truth, radius_km, grid=(8, 4)):
    """Occlusion test: hide each patch, measure how much the attacker's confidence near the truth drops."""
    W, H = img.size
    gx, gy = grid
    blurred = img.filter(ImageFilter.GaussianBlur(radius=max(W, H) / 20))
    variants, boxes = [], []
    for j in range(gy):
        for i in range(gx):
            box = (i * W // gx, j * H // gy, (i + 1) * W // gx, (j + 1) * H // gy)
            v = img.copy()
            v.paste(blurred.crop(box), box)
            variants.append(v)
            boxes.append(box)
    probs = attack([img] + variants)
    s = summarize(probs, truth, radius_km)
    base = s[0].mass_in_radius
    scores = np.array([max(0.0, base - g.mass_in_radius) for g in s[1:]])
    return boxes, scores, base


def best_crop(img, truth, radius_km, keep_box=None, min_area=0.55):
    """Search Instagram-ratio crops; return the one where the attacker is least sure of the truth."""
    W, H = img.size
    cands = []
    for ratio in (1.0, 4 / 5, 16 / 9, 3 / 2, W / H):
        for scale in (1.0, 0.85, 0.72, 0.6):
            ch = min(H, int(round(H * scale)))
            cw = int(round(ch * ratio))
            if cw > W:
                cw, ch = W, int(round(W / ratio))
            if cw * ch < min_area * W * H * (0.5 if W / H > 1.8 else 1):
                continue
            for fx in np.linspace(0, 1, 6):
                for fy in np.linspace(0, 1, 3):
                    x, y = int((W - cw) * fx), int((H - ch) * fy)
                    b = (x, y, x + cw, y + ch)
                    if keep_box and not (b[0] <= keep_box[0] and b[1] <= keep_box[1] and b[2] >= keep_box[2] and b[3] >= keep_box[3]):
                        continue
                    cands.append(b)
    cands = list(dict.fromkeys(cands))
    s = summarize(attack([img.crop(b) for b in cands]), truth, radius_km)
    i = int(np.argmin([g.mass_in_radius for g in s]))
    return cands[i], s[i]


def inpaint(img, boxes, pad=0.08):
    """Fill only the masked boxes with LaMa; every pixel outside the mask is copied from the input."""
    W, H = img.size
    mask = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(mask)
    for b in boxes:
        px, py = int((b[2] - b[0]) * pad), int((b[3] - b[1]) * pad)
        d.rectangle((b[0] - px, b[1] - py, b[2] + px, b[3] + py), fill=255)
    filled = _lama_model()(img.convert("RGB"), mask).resize((W, H))
    out = img.convert("RGB").copy()
    out.paste(filled, (0, 0), mask)
    return out, mask


@dataclass
class Step:
    label: str
    image: Image.Image
    guess: Guess
    note: str = ""
    overlay: Image.Image | None = None


@dataclass
class Result:
    truth: tuple
    radius_km: float
    steps: list = field(default_factory=list)
    pixels_unchanged: float = 1.0
    passed: bool = False


def heat_overlay(img, boxes, scores):
    ov = img.convert("RGBA").copy()
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    top = scores.max() if scores.max() > 0 else 1
    for b, s in zip(boxes, scores):
        a = int(170 * s / top)
        if a > 10:
            d.rectangle(b, fill=(255, 40, 40, a), outline=(255, 255, 255, min(255, a + 60)), width=2)
    return Image.alpha_composite(ov, layer).convert("RGB")


def protect(img, radius_km=25.0, truth=None, target_mass=0.10, max_rounds=3, top_patches=3):
    img = img.convert("RGB")
    if max(img.size) > 1400:
        img.thumbnail((1400, 1400))
    g0 = summarize(attack([img]), truth or (0, 0), radius_km)[0]
    if truth is None:  # no ground truth given: use the attacker's own first guess as "where it is"
        truth = (g0.lat, g0.lon)
        g0 = summarize(attack([img]), truth, radius_km)[0]
    r = Result(truth=truth, radius_km=radius_km)
    boxes, scores, _ = clue_map(img, truth, radius_km)
    r.steps.append(Step("Original", img, g0, "What the attacker sees.", heat_overlay(img, boxes, scores)))

    # 1. cheapest edit: reframe
    cb, gc = best_crop(img, truth, radius_km)
    cur = img.crop(cb)
    r.steps.append(Step("Step 1 · Crop", cur, gc, f"Crop to {cb[2]-cb[0]}×{cb[3]-cb[1]} (no pixels edited)."))
    original_in_crop = cur.copy()
    total_mask = Image.new("L", cur.size, 0)

    # 2. remove only the strongest clues, re-attack, repeat
    for k in range(max_rounds):
        if r.steps[-1].guess.mass_in_radius <= target_mass:
            break
        boxes, scores, _ = clue_map(cur, truth, radius_km)
        idx = [i for i in np.argsort(-scores)[:top_patches] if scores[i] > 0]
        if not idx:
            break
        ov = heat_overlay(cur, boxes, scores)
        cur, m = inpaint(cur, [boxes[i] for i in idx])
        total_mask.paste(255, (0, 0), m)
        g = summarize(attack([cur]), truth, radius_km)[0]
        r.steps.append(Step(f"Step {k+2} · Remove {len(idx)} clue(s)", cur, g, "Masked fill (LaMa); pixels outside the mask are copied unchanged.", ov))

    diff = np.abs(np.asarray(cur, dtype=np.int16) - np.asarray(original_in_crop, dtype=np.int16)).max(axis=2)
    r.pixels_unchanged = float((diff <= 2).mean())
    r.passed = r.steps[-1].guess.mass_in_radius <= target_mass or r.steps[-1].guess.km_from_truth > radius_km
    return r


# ---------- Claude path: a frontier VLM attacker that also says WHICH regions it used ----------


@dataclass
class VGuess:
    lat: float
    lon: float
    km_from_truth: float
    place: str
    clues: list  # [(box_px, importance, description)]
    mass_in_radius: float = float("nan")


def vlm_guess(img, truth, attack_fn):
    g = attack_fn(img)
    if g is None:
        return VGuess(float("nan"), float("nan"), float("inf"), "(attacker declined)", [])
    W, H = img.size
    clues = []
    for c in g.clues:
        x0, y0, x1, y1 = (max(0.0, min(1.0, v)) for v in (c.box + [0, 0, 1, 1])[:4])
        clues.append(((int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)), c.importance, f"{c.description} → {c.reveals}"))
    km = float(haversine_km(truth[0], truth[1], g.lat, g.lon)) if truth else 0.0
    return VGuess(g.lat, g.lon, km, g.place, clues)


def clue_overlay(img, clues):
    ov = img.convert("RGB").copy()
    d = ImageDraw.Draw(ov)
    for box, imp, _ in clues:
        d.rectangle(box, outline=(255, 40, 40), width=max(2, imp + 1))
    return ov


def _clue_weight_inside(clues, crop):
    w = 0.0
    for (x0, y0, x1, y1), imp, _ in clues:
        ix = max(0, min(x1, crop[2]) - max(x0, crop[0]))
        iy = max(0, min(y1, crop[3]) - max(y0, crop[1]))
        area = max(1, (x1 - x0) * (y1 - y0))
        w += imp * (ix * iy) / area
    return w


def crop_away(img, clues, min_area=0.6):
    """Pick the Instagram-ratio crop that leaves out the most clue weight. No pixel is edited."""
    W, H = img.size
    best, best_w = (0, 0, W, H), _clue_weight_inside(clues, (0, 0, W, H))
    full_w = best_w
    for ratio in (1.0, 4 / 5, 3 / 2, 16 / 9, W / H):
        for scale in np.linspace(1.0, 0.6, 9):
            ch = int(H * scale)
            cw = int(ch * ratio)
            if cw > W:
                cw, ch = W, int(W / ratio)
            if cw * ch < min_area * W * H * (0.55 if W / H > 1.8 else 1):
                continue
            for fx in np.linspace(0, 1, 11):
                for fy in np.linspace(0, 1, 5):
                    x, y = int((W - cw) * fx), int((H - ch) * fy)
                    c = (x, y, x + cw, y + ch)
                    w = _clue_weight_inside(clues, c) + 0.5 * (1 - cw * ch / (W * H)) * full_w  # small penalty for lost area
                    if w < best_w - 1e-6:
                        best, best_w = c, w
    return best


def protect_vlm(img, truth, radius_km, attack_fn, final_fn=None, rounds=3, max_box_frac=0.15):
    img = img.convert("RGB")
    if max(img.size) > 1400:
        img.thumbnail((1400, 1400))
    g = vlm_guess(img, truth, attack_fn)
    if truth is None:
        truth = (g.lat, g.lon)
        g.km_from_truth = 0.0
    r = Result(truth=truth, radius_km=radius_km)
    r.steps.append(Step("Original", img, g, f"Attacker: {g.place}", clue_overlay(img, g.clues)))
    cur, base = img, img
    for k in range(rounds):
        if g.km_from_truth > radius_km:
            break
        note = []
        if k == 0:  # cheapest edit first: reframe
            c = crop_away(cur, g.clues)
            if c != (0, 0, *cur.size):
                cur = cur.crop(c)
                base = cur.copy()
                note.append(f"cropped to {c[2]-c[0]}×{c[3]-c[1]}")
                g = vlm_guess(cur, truth, attack_fn)  # fresh attacker on the crop
                r.steps.append(Step("Crop (no pixels edited)", cur, g, f"Attacker: {g.place}", clue_overlay(cur, g.clues)))
                if g.km_from_truth > radius_km:
                    break
        W, H = cur.size
        targets = [b for b, imp, _ in g.clues if imp >= 2 and (b[2] - b[0]) * (b[3] - b[1]) <= max_box_frac * W * H]
        if not targets:
            break
        cur, _ = inpaint(cur, targets, pad=0.15)
        g = vlm_guess(cur, truth, attack_fn)
        r.steps.append(Step(f"Remove {len(targets)} clue(s)", cur, g, f"Attacker: {g.place}", clue_overlay(cur, g.clues)))
    if final_fn is not None:  # strongest attacker (web search) checks the final photo once
        g = vlm_guess(cur, truth, final_fn)
        r.steps.append(Step("Final check (web search)", cur, g, f"Attacker: {g.place}", clue_overlay(cur, g.clues)))
    diff = np.abs(np.asarray(cur, dtype=np.int16) - np.asarray(base, dtype=np.int16)).max(axis=2)
    r.pixels_unchanged = float((diff <= 2).mean())
    r.passed = r.steps[-1].guess.km_from_truth > radius_km
    return r


if __name__ == "__main__":
    import sys, time

    t = time.time()
    im = Image.open(sys.argv[1])
    truth = (float(sys.argv[2]), float(sys.argv[3])) if len(sys.argv) > 3 else None
    res = protect(im, radius_km=float(sys.argv[4]) if len(sys.argv) > 4 else 25, truth=truth)
    for s in res.steps:
        g = s.guess
        print(f"{s.label:28s} guess=({g.lat:.3f},{g.lon:.3f}) {g.km_from_truth:8.1f} km  P(in radius)={g.mass_in_radius:.2f}")
    print(f"pixels unchanged (in crop): {res.pixels_unchanged:.1%}  passed={res.passed}  {time.time()-t:.0f}s")
    for i, s in enumerate(res.steps):
        s.image.save(f"out_{i}.jpg")
        if s.overlay:
            s.overlay.save(f"out_{i}_clues.jpg")
