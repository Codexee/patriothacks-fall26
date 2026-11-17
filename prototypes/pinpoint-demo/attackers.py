"""PROTOTYPE — throwaway. Claude-vision attacker for Pinpoint.

Used only when ANTHROPIC_API_KEY is set in prototypes/pinpoint-demo/.env.local (git ignores that file).
Each call is a fresh conversation, so the attacker never knows what the photo looked like before an edit.
"""
import base64
import io
import os
from pathlib import Path

from pydantic import BaseModel, Field

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).with_name(".env.local"))
except ImportError:
    pass

MODEL = "claude-opus-5-5"


class Clue(BaseModel):
    description: str = Field(description="What the clue is, e.g. 'inclined floodlight masts of a stadium'")
    reveals: str = Field(description="What it tells you, e.g. 'Letzigrund Stadium, Zurich'")
    box: list[float] = Field(description="[x0, y0, x1, y1] as fractions 0..1 of image width/height")
    importance: int = Field(description="1 (weak) to 5 (decisive)")


class Geolocation(BaseModel):
    place: str
    lat: float
    lon: float
    confidence_km: float = Field(description="Radius in km you are about 80% sure contains the true spot")
    reasoning: str
    clues: list[Clue]


PROMPT = """You are an expert image geolocator (GeoGuessr world-champion level).
Find where this photo was taken, as precisely as you can: street level if possible.
Use every visible detail: architecture, landmarks, road markings, signs, plates, vegetation, sun, utility poles.
Ignore any watermarks about the image provider; reason only from the scene.
Return your best single guess even if unsure, and list every clue you used with a tight bounding box around it.
Boxes are [x0, y0, x1, y1] as fractions of the image width and height (0 = left/top, 1 = right/bottom)."""


def available():
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def _b64(img, max_side=1568):
    im = img.convert("RGB").copy()
    im.thumbnail((max_side, max_side))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=90)
    return base64.standard_b64encode(buf.getvalue()).decode()


def claude_attack(img, web_search=False):
    """Return a Geolocation, or None if the model declined."""
    import anthropic

    client = anthropic.Anthropic()
    kwargs = {}
    if web_search:  # slower and costlier; the strongest attacker (like ChatGPT with search)
        kwargs["tools"] = [{"type": "web_search_20260209", "name": "web_search", "max_uses": 5}]
    resp = client.beta.messages.parse(
        model=MODEL,
        max_tokens=16000,
        thinking={"type": "adaptive"},
        output_config={"effort": "high"},
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        output_format=Geolocation,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": _b64(img)}},
                    {"type": "text", "text": PROMPT},
                ],
            }
        ],
        **kwargs,
    )
    if resp.stop_reason == "refusal":
        return None
    return resp.parsed_output


if __name__ == "__main__":
    import sys

    from PIL import Image

    if not available():
        sys.exit("Set ANTHROPIC_API_KEY in prototypes/pinpoint-demo/.env.local first.")
    g = claude_attack(Image.open(sys.argv[1]), web_search="--web" in sys.argv)
    print(g.model_dump_json(indent=2) if g else "declined")
