// PROTOTYPE, throwaway. Answers one question: does GLiNER-PII run in the browser in < 300 ms per prompt?
import { env } from '@xenova/transformers';
import { Gliner } from 'gliner';

env.localModelPath = '/models/';
env.allowRemoteModels = false;

const LABELS = ['person', 'organization', 'location', 'address', 'email', 'phone number',
  'social security number', 'bank account number', 'credit card number', 'date of birth'];

// Realistic prompts at three lengths (fictional people only).
const PROMPTS = {
  short: 'Email Dana Whitfield at dana.w@example.org and tell her the Fairfax clinic moved my appointment.',
  medium: 'Help me write a letter to Northgate Federal Credit Union. My name is Marcus Ellery, I live at 4127 Lindell Road, Annandale VA 22003, and my checking account 004417829915 was charged twice by Harbor Fitness on October 3. My wife Priya works in billing at Inova so she noticed it first. Please keep it short and polite, and ask them to call me at (703) 555-0148.',
  long: 'I need a timeline for my lawyer. In March I started organizing with the tenants union at Colfax Commons with my neighbor Ruth Okafor and her son Daniel. The property manager, Glen Hartley from Brightline Residential, sent us a notice on April 14 saying our leases would not renew. My sister Elena, who is a nurse at Mount Vernon Hospital, told me the same company did this to her friend in Alexandria. On May 2 I emailed glen.hartley@brightline-res.example and copied the county housing office. My SSN is 123-45-6789 and they asked for it on the renewal form, which seemed strange. I also paid the May rent from my Capital Ridge account ending 7731 by check number 1042. Can you turn this into a clean, dated list of events, and flag anything that sounds like retaliation under Virginia law? Keep the names so my lawyer can follow it.',
};

const q = new URLSearchParams(location.search);
const TH = +(q.get('th') || 0.5);
const out = document.getElementById('out');
const log = (s) => { out.textContent += s + '\n'; console.log(s); };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

async function bench({ model, dtype, ep, threads, runs }) {
  out.textContent = '';
  const file = dtype === 'fp32' ? 'model.onnx' : `model_${dtype}.onnx`;
  log(`model=${model} dtype=${dtype} ep=${ep} threads=${threads} isolated=${crossOriginIsolated} cores=${navigator.hardwareConcurrency} webgpu=${!!navigator.gpu}`);
  const t0 = performance.now();
  const g = new Gliner({
    tokenizerPath: model,
    onnxSettings: { modelPath: `/models/${model}/${file}`, executionProvider: ep, wasmPaths: '/ort/', multiThread: threads > 1, maxThreads: threads },
    transformersSettings: { allowLocalModels: true, useBrowserCache: false },
    maxWidth: 12,
    modelType: 'token-level',
  });
  await g.initialize();
  // FIX: gliner.js hardcodes the start token as id 1 (DeBERTa [CLS]). For the Ettin/ModernBERT
  // tokenizer, id 1 is <|padding|>. Use the tokenizer's real [CLS] id.
  const proc = g.model.processor;
  const cls = proc.tokenizer.cls_token_id ?? proc.tokenizer.model.tokens_to_ids.get('[CLS]');
  const origEncode = proc.encodeInputs.bind(proc);
  proc.encodeInputs = (texts, promptLengths) => {
    const [ids, att, wm] = origEncode(texts, promptLengths);
    ids.forEach((row) => { row[0] = cls; });
    return [ids, att, wm];
  };
  // DEBUG: report the raw logits layout once.
  const wrap = g.model.onnxWrapper; const origRun = wrap.run.bind(wrap); let logged = false;
  wrap.run = async (feeds, o) => {
    const r = await origRun(feeds, o);
    if (!logged) { logged = true; const d = r.logits.data; let mx = -1e9; for (const v of d) if (v > mx) mx = v;
      log(`logits dims=${JSON.stringify(r.logits.dims)} max=${mx.toFixed(2)} inputs=${JSON.stringify(Object.fromEntries(Object.entries(feeds).map(([k, v]) => [k, v.dims])))} outputs=${Object.keys(r)}`); }
    // FIX: model emits [B, L, C, 3]; gliner.js TokenDecoder reads [3, B, L, C]. Transpose.
    const [B, L, C, K] = r.logits.dims; const src = r.logits.data; const dst = new Float32Array(src.length);
    for (let b = 0; b < B; b++) for (let l = 0; l < L; l++) for (let c = 0; c < C; c++) for (let k = 0; k < K; k++)
      dst[((k * B + b) * L + l) * C + c] = src[((b * L + l) * C + c) * K + k];
    return { logits: { data: dst, dims: [K, B, L, C] } };
  };
  log(`cls_token_id=${cls} sep_token_id=${proc.tokenizer.sep_token_id} sample=${JSON.stringify(proc.tokenizer.encode('Marcus'))}`);
  const loadMs = performance.now() - t0;
  log(`load+init: ${loadMs.toFixed(0)} ms`);

  const result = { model, dtype, ep, threads, loadMs, prompts: {} };
  for (const [name, text] of Object.entries(PROMPTS)) {
    const words = text.split(/\s+/).length;
    const tFirst = performance.now();
    const first = await g.inference({ texts: [text], entities: LABELS, threshold: TH, flatNer: true });
    const firstMs = performance.now() - tFirst;
    for (let i = 0; i < 2; i++) await g.inference({ texts: [text], entities: LABELS, threshold: TH, flatNer: true });
    const times = [];
    for (let i = 0; i < runs; i++) {
      const t = performance.now();
      await g.inference({ texts: [text], entities: LABELS, threshold: TH, flatNer: true });
      times.push(performance.now() - t);
    }
    const p50 = pct(times, 0.5), p95 = pct(times, 0.95);
    const ents = first[0].map((e) => `${e.label}:"${e.spanText}"(${e.score.toFixed(2)})`);
    result.prompts[name] = { words, firstMs, p50, p95, ents };
    log(`\n[${name}] ${words} words  first=${firstMs.toFixed(0)}ms  p50=${p50.toFixed(0)}ms  p95=${p95.toFixed(0)}ms  ${p95 < 300 ? 'PASS' : 'FAIL'}`);
    log('  ' + ents.join('\n  '));
  }
  window.__result = result;
  return result;
}

const cfg = () => ({
  model: q.get('model') || document.getElementById('model').value,
  dtype: q.get('dtype') || document.getElementById('dtype').value,
  ep: q.get('ep') || document.getElementById('ep').value,
  threads: +(q.get('threads') || navigator.hardwareConcurrency || 4),
  runs: +(q.get('runs') || 10),
});
document.getElementById('run').onclick = () => bench(cfg()).catch((e) => { log('ERROR ' + e.stack); window.__error = String(e); });
if (q.get('auto')) bench(cfg()).catch((e) => { log('ERROR ' + (e.stack || e)); window.__error = String(e.message || e); });
