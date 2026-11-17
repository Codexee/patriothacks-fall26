# PROTOTYPE (throwaway): gate G2, the agent sees only stand-ins

**Question:** When an AI browser agent reads our fake bank page, does it see only stand-ins? And when it types a stand-in into a form, does the bank get the real value?

**Answer: yes, after one bug fix.** Tested on Tue 2026-11-17 with the Claude in Chrome extension tools (`get_page_text`, `read_page` accessibility tree, screenshots, `find`, clicks and typing). These are the same read channels that Claude for Chrome uses.

## Run it

```bash
node server.mjs   # http://localhost:5299 ; what the bank receives goes to received.jsonl
```

## Results

| Place a real value can hide | Agent saw |
| --- | --- |
| Visible text, table rows, `document.title` | stand-in |
| `title`, `aria-label` attributes; `value` attribute; input value set from JS | stand-in |
| `display:none` element (shows in the accessibility tree) and off-screen element | stand-in |
| Open shadow DOM, same-origin iframe | stand-in |
| Text added 2 s after load (MutationObserver) | stand-in |
| Masked numbers: `··9915`, `Card ending 1111` | stand-in last 4 (`··8846`, `ending 1881`) |
| Submit: the agent typed `007302518846` (stand-in) | bank received `004417829915` (real); the screen kept showing the stand-in |
| Bank's confirmation page, which echoes the real number | stand-in |

The submit swap uses the `formdata` event, so the real value goes into the submitted data but never appears on screen, in the DOM, or in a screenshot.

## Bugs found

1. **First run leaked** the late-loaded SSN and name, the shadow DOM, and the masked last 4. Cause: `walk()` called `rewriteNode()` on a shadow root's host, which walked the same shadow root again (infinite recursion). The script crashed before it set up the observer. Fixed.
2. **Masked last-4 digits** are a leak that a plain find-and-replace misses. `packages/rewrite` must map them (done here with a regex).

## Still open (for `packages/rewrite` and the extension)

- Here the rewrite script is in the page. In the extension it must be a content script with `"run_at": "document_start"`, `"world": "MAIN"` and `"all_frames": true`. Hide the page until the first pass is done, so that no early screenshot shows real values.
- Closed shadow roots and cross-origin iframes cannot be read by a page script. The fake bank must not use them.
- `fetch`/XHR form submits do not fire `formdata`. Also patch `fetch` and `XMLHttpRequest.send`, or keep the fake bank on native form posts.
- The real Claude for Chrome side panel (its own safety settings, its refusal on bank-like sites) was not tested here. Test it once by hand, or with Paradev `superset:computer` after a driver is installed.
