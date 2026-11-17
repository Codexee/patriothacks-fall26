# PROTOTYPE (throwaway): GLiNER-PII browser benchmark

**Question:** Does GLiNER-PII run in the browser in under 300 ms per prompt? This is the Tue-night gate for workstream 1 in `.plans/off-the-record-spec.md`.

**Answer: yes, with a large margin.** The slowest working config took 172 ms p95 on a 147-word prompt (single thread). The recommended config took 83 ms.

**Budget update (Neil, 2026-11-17):** the per-prompt budget is now 500–1000 ms, not 300 ms. Every working config here fits, even on one thread. Speed is no longer the deciding factor, so choose the model by recall. The larger `gliner-pii-base-v1.0` (197 MB quint8) was not tested and may also fit the new budget.

## Run it

```bash
npm install
npm run dev      # serves http://localhost:5199 (cross-origin isolated, for WASM threads)
npm run bench    # in a second shell: runs every config in system Chrome, writes results.json
python3 score.py # scores results.json against the answer key
```

The models are not in git. Download them into `public/models/{edge,small}/` from `knowledgator/gliner-pii-{edge,small}-v1.0` on Hugging Face (`onnx/*.onnx` plus the tokenizer and config JSON files), then run `python3 fix-tokenizer.py public/models/*/tokenizer.json`. Copy `node_modules/onnxruntime-web/dist/*.{wasm,mjs}` into `public/ort/`.

## Results

Machine: Apple M5 Pro (15 cores), 24 GB, Chrome 157, headless. 10 timed runs after 2 warm-up runs. 10 labels. Recall is measured against an 18-item answer key: names, organizations, places, the address, and the SSN. Emails, phones, and account numbers belong to the rules layer and are not scored.

| Model | Weights | Backend | Threshold | Size | Load | p95, 14 words | p95, 66 words | p95, 147 words | Recall |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| edge (32M) | quint8 | WASM, 15 threads | 0.5 | 46 MB | 391 ms | 20 ms | 44 ms | 83 ms | 15/18 |
| **edge (32M)** | **quint8** | **WASM, 15 threads** | **0.3** | **46 MB** | **348 ms** | **20 ms** | **42 ms** | **83 ms** | **18/18** |
| edge (32M) | quint8 | WASM, 1 thread | 0.5 | 46 MB | 323 ms | 28 ms | 82 ms | 172 ms | 15/18 |
| edge (32M) | fp32 | WASM, 15 threads | 0.5 | 181 MB | 534 ms | 20 ms | 49 ms | 83 ms | 17/18 |
| edge (32M) | fp32 | WebGPU | 0.5 | 181 MB | 577 ms | 47 ms | 46 ms | 66 ms | 17/18 |
| edge (32M) | fp16 | WebGPU | — | 91 MB | fails | — | — | — | — |
| small (68M) | quint8 | WASM, 15 threads | 0.5 | 83 MB | 509 ms | 34 ms | 69 ms | 119 ms | 16/18 |
| small (68M) | quint8 | WASM, 15 threads | 0.3 | 83 MB | 512 ms | 70 ms | 74 ms | 136 ms | 17/18 |
| small (68M) | fp32 | WASM, 15 threads | 0.5 | 246 MB | 777 ms | 31 ms | 66 ms | 123 ms | 16/18 |
| small (68M) | fp32 | WebGPU | 0.5 | 246 MB | 853 ms | 78 ms | 79 ms | 102 ms | 16/18 |

Load time is from local disk. On a first visit, the download time is added: 46 MB for the edge quint8 model.
WebGPU's first call takes 400–930 ms (shader compile), so pre-warm it.

## Recommendation for `packages/core`

- Use **`knowledgator/gliner-pii-edge-v1.0`, `model_quint8.onnx`, WASM, threshold 0.3**. It is the smallest download, the fastest model, and it had the best recall here. Quantization lowers the scores (max logit 0.92 against 1.97 for fp32), so 0.5 is too strict for quint8.
- Run it in a Web Worker. The site must send COOP/COEP headers to get WASM threads; without them, expect about 2× slower (still under 300 ms).
- Skip WebGPU. It is not faster for a model this small, and fp16 does not load.
- Do not trust the model for emails, phones, or account numbers. It finds some of them, but not reliably. That is the job of the rules layer, as the spec says.
- Caveat: the answer key has only 3 prompts and 18 items. Re-check recall on the real bank page and the activist chat log before you lock in the threshold.

## `gliner@0.0.19` bugs we had to patch (the real build must fix these too)

These models use the Ettin (ModernBERT) encoder and token-level decoding. `gliner.js` was written for DeBERTa span models. Without the three fixes below, the model returns **zero entities** but still looks fast.

1. **Tokenizer will not load.** The bundled `@xenova/transformers@2.17` expects BPE merges as `"a b"` strings, but the new `tokenizer.json` stores them as `["a", "b"]` pairs. Fix: `fix-tokenizer.py`, or move to `@huggingface/transformers` v3.
2. **Wrong start token.** `encodeInputs` hardcodes token id `1` as `[CLS]`. In this tokenizer, id 1 is `<|padding|>`, and `[CLS]` is 50281. Fix: patched in `bench.js`.
3. **Wrong logits layout.** The model outputs `[batch, words, labels, 3]`. `TokenDecoder` reads `[3, batch, words, labels]`. Fix: transpose before decoding (patched in `bench.js`).

Because there are three bugs, `packages/core` should own a small GLiNER wrapper (tokenize, run ONNX, decode) and call `onnxruntime-web` directly, instead of depending on `gliner.js`.
