// PROTOTYPE page rewrite (gate G2). Builds the AI's view of the page: every real vault value becomes its stand-in.
// Covers: text nodes, attributes, input values, option text, document.title, open shadow roots, same-origin iframes.
// Submit swap: the 'formdata' event puts real values into the submitted data without changing what is on screen.
(() => {
  const PAIRS = window.OTR_VAULT || [];
  // Masked numbers ("··9915", "ending 1111") leak the real last 4 digits. Map them to the stand-in's last 4.
  const digits = (s) => s.replace(/\D/g, '');
  const LAST4 = PAIRS.filter(([r]) => digits(r).length >= 8).map(([r, f]) => [digits(r).slice(-4), digits(f).slice(-4)]);
  const MASK = /((?:[·•*xX]{2,}|ending(?: in)?\s+|ends in\s+|last 4:?\s*)\s*)(\d{4})\b/g;
  const toFake = (s) => {
    for (const [real, fake] of PAIRS) s = s.split(real).join(fake);
    return s.replace(MASK, (m, pre, d) => { const hit = LAST4.find(([r]) => r === d); return hit ? pre + hit[1] : m; });
  };
  const toReal = (s) => { for (const [real, fake] of PAIRS) s = s.split(fake).join(real); return s; };
  const ATTRS = ['title', 'aria-label', 'aria-description', 'alt', 'placeholder', 'value', 'data-tooltip', 'content'];
  const stats = { text: 0, attr: 0, input: 0 };

  function rewriteNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const v = toFake(node.nodeValue); if (v !== node.nodeValue) { node.nodeValue = v; stats.text++; }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    for (const a of ATTRS) {
      const v = node.getAttribute(a);
      if (v != null) { const f = toFake(v); if (f !== v) { node.setAttribute(a, f); stats.attr++; } }
    }
    if ((node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') && node.value) {
      const f = toFake(node.value); if (f !== node.value) { node.value = f; stats.input++; }
    }
    if (node.shadowRoot) { walk(node.shadowRoot); observe(node.shadowRoot); }
    if (node.tagName === 'IFRAME') {
      try { const d = node.contentDocument; if (d && d.readyState !== 'loading') { walk(d); observe(d); } node.addEventListener('load', () => { walk(node.contentDocument); observe(node.contentDocument); }); } catch { /* cross-origin: the extension must inject into all frames */ }
    }
  }
  function walk(root) {
    const it = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    // FIX: never call rewriteNode on a shadow root's host here; that walks the same shadow root again (infinite loop).
    if (root.nodeType === Node.ELEMENT_NODE) rewriteNode(root); let n; while ((n = it.nextNode())) rewriteNode(n);
  }
  function observe(root) {
    if (root.__otrObserved) return; root.__otrObserved = true;
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData') rewriteNode(m.target);
        else if (m.type === 'attributes') rewriteNode(m.target);
        else m.addedNodes.forEach((n) => (n.nodeType === 1 ? walk(n) : rewriteNode(n)));
      }
    }).observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  // Submit swap: the agent typed stand-ins; the bank receives real values. The screen keeps showing stand-ins.
  document.addEventListener('formdata', (e) => {
    for (const [k, v] of [...e.formData.entries()]) if (typeof v === 'string') e.formData.set(k, toReal(v));
  }, true);

  function run() {
    document.title = toFake(document.title);
    walk(document.documentElement); observe(document.documentElement);
    window.__otr = { stats, ready: true };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  // Late-set input values (frameworks set .value without an attribute).
  document.addEventListener('input', (e) => { /* agent typing: leave as typed (stand-ins) */ }, true);
})();
