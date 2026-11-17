"""PROTOTYPE — throwaway. Pinpoint tech demo UI.

Run:  prototypes/pinpoint-demo/.venv/bin/python prototypes/pinpoint-demo/app.py   → http://127.0.0.1:7860
"""
from pathlib import Path

import gradio as gr
from PIL import Image

import attackers
import pinpoint as P

HERE = Path(__file__).parent
SAMPLES = {}
for line in (HERE / "samples" / "truth.tsv").read_text().splitlines() if (HERE / "samples" / "truth.tsv").exists() else []:
    n, lat, lon, *_ = line.split("\t")
    SAMPLES[n] = (HERE / "samples" / f"{n}.jpg", float(lat), float(lon))
if (HERE / "samples" / "zurich_streetview.webp").exists():
    SAMPLES["zurich_streetview"] = (HERE / "samples" / "zurich_streetview.webp", 47.3830, 8.5035)

RADII = {"Street (1 km)": 1.0, "Neighborhood (5 km)": 5.0, "City (25 km)": 25.0}
ATTACKERS = ["Claude vision", "Claude vision + web-search final check", "GeoCLIP (offline, weak)"]


def load_sample(name):
    if not name:
        return None, "", ""
    p, lat, lon = SAMPLES[name]
    return Image.open(p), str(lat), str(lon)


def osm(lat, lon):
    return f"[{lat:.4f}, {lon:.4f}](https://www.openstreetmap.org/?mlat={lat}&mlon={lon}#map=15/{lat}/{lon})"


def run(img, lat, lon, radius_name, attacker):
    if img is None:
        raise gr.Error("Upload a photo or pick a sample.")
    truth = (float(lat), float(lon)) if lat and lon else None
    radius = RADII[radius_name]
    if attacker.startswith("Claude"):
        if not attackers.available():
            raise gr.Error("No ANTHROPIC_API_KEY in prototypes/pinpoint-demo/.env.local. Use GeoCLIP, or add a key.")
        final = (lambda im: attackers.claude_attack(im, web_search=True)) if "web" in attacker else None
        r = P.protect_vlm(img, truth, radius, attackers.claude_attack, final_fn=final)
    else:
        r = P.protect(img, radius_km=radius, truth=truth)

    gallery, rows = [], []
    for s in r.steps:
        g = s.guess
        where = getattr(g, "place", "") or ""
        cap = f"{s.label} · guess {g.km_from_truth:.1f} km from the real spot"
        gallery.append((s.overlay or s.image, cap + (" · red = clues the attacker used" if s.overlay else "")))
        extra = "" if g.mass_in_radius != g.mass_in_radius else f" · P(inside radius) = {g.mass_in_radius:.0%}"
        rows.append(f"| {s.label} | {where} {osm(g.lat, g.lon) if g.lat == g.lat else ''} | **{g.km_from_truth:.1f} km**{extra} |")
    last = r.steps[-1]
    verdict = "✅ **Passes**" if r.passed else "⚠️ **Does not pass yet**"
    md = (
        f"{verdict}: the attacker's last guess is **{last.guess.km_from_truth:.1f} km** away (privacy radius {radius:g} km).  \n"
        f"**{r.pixels_unchanged:.1%}** of the pixels in the posted photo are unchanged from the original.\n\n"
        "| Step | Attacker's guess | Distance from the real spot |\n|---|---|---|\n" + "\n".join(rows)
    )
    clues = []
    for s in r.steps:
        for box, imp, desc in getattr(s.guess, "clues", []) or []:
            clues.append(f"- *{s.label}*: {desc} (importance {imp}/5)")
    if clues:
        md += "\n\n**Clues the attacker reported**\n" + "\n".join(clues)
    return gallery, md, r.steps[0].image, last.image


with gr.Blocks(title="Pinpoint prototype") as demo:
    gr.Markdown(
        "# Pinpoint · prototype\n"
        "An AI attacker finds where your photo was taken. Pinpoint removes **only** the clues it used "
        "(crop first, then a small masked fill), and attacks again with a fresh attacker until the guess is outside your privacy radius."
    )
    if not attackers.available():
        gr.Markdown("> ⚠️ No Claude key found, so only the weak offline attacker (GeoCLIP) works. See `README.md` to add a key.")
    with gr.Row():
        with gr.Column(scale=1):
            sample = gr.Dropdown(list(SAMPLES), label="Sample photo (fills in the real location)")
            img = gr.Image(type="pil", label="Photo")
            with gr.Row():
                lat = gr.Textbox(label="Real latitude (optional)")
                lon = gr.Textbox(label="Real longitude (optional)")
            radius = gr.Radio(list(RADII), value="Neighborhood (5 km)", label="Hide everything finer than")
            attacker = gr.Radio(ATTACKERS, value=ATTACKERS[0] if attackers.available() else ATTACKERS[2], label="Attacker")
            go = gr.Button("Protect this photo", variant="primary")
        with gr.Column(scale=2):
            with gr.Row():
                before = gr.Image(label="Before", interactive=False)
                after = gr.Image(label="After (what you would post)", interactive=False)
            summary = gr.Markdown()
            steps = gr.Gallery(label="Each round: attack → clues → edit → attack again", columns=3, height="auto")
    sample.change(load_sample, sample, [img, lat, lon])
    go.click(run, [img, lat, lon, radius, attacker], [steps, summary, before, after])

if __name__ == "__main__":
    demo.launch(server_name="127.0.0.1", server_port=7860)
