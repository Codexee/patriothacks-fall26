# Pinpoint prototype (throwaway)

**Question this answers:** can a loop of *attack → find the clues → cheapest edit → attack again* hide where a photo was taken, while the photo still looks the same?

This is not the product. It is not part of the spec. Delete it when the spec is locked.

## Run it

```bash
cd prototypes/pinpoint-demo
conda create -y -p ./.venv python=3.12
./.venv/bin/pip install torch torchvision geoclip simple-lama-inpainting gradio anthropic pydantic python-dotenv
./.venv/bin/python app.py        # then open http://127.0.0.1:7860
```

## Attackers

| Attacker | Where it runs | Strength |
| --- | --- | --- |
| Claude vision (`claude-opus-5-5`) | Anthropic API, needs a key | Strong. It reasons about the scene and returns the clues it used, with boxes |
| Claude vision + web search (final check only) | Anthropic API | Strongest. Close to "ChatGPT with search" |
| GeoCLIP | Local, on the Mac GPU | **Weak. Do not use it as the benchmark.** On our 5 test photos it placed only 1 within 25 km |

## The API key stays on your machine

Create `prototypes/pinpoint-demo/.env.local` with one line:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Git ignores this file. Never paste the key into chat or commit it.

## Files

- `pinpoint.py`: the loop (attack, crop search, LaMa masked fill, pixel-change count)
- `attackers.py`: the Claude attacker (structured output: place, lat/lon, and clues with boxes)
- `app.py`: the one-page demo UI
- `samples/`: test photos (not committed). The sources and licenses are in `samples/truth.tsv`.
