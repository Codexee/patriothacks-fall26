# Off the Record: exploration (next phase of consideration)

> **Status (Nov 17):** this idea is in the **next phase of consideration**. It is not locked. **Adarsh: workshop this file.** Open questions are at the bottom. Off the Record includes **Unsign** (writing-style protection, round 5).

## One line

A small, fast model that runs on your own computer and sits between you and **every** AI you use (chatbots, AI browsers, computer-use agents, coding agents, MCP tools, and file uploads). It replaces anything that identifies you, including context and writing style, before it leaves your machine. It puts the real values back when the answer comes back, and it lets an agent *use* your private data without ever *seeing* it.

## The hook

**"A court ordered OpenAI to hand over 20 million ChatGPT conversations."** (S.D.N.Y., Jan 5, 2026.) The court accepted that the logs were "de-identified". Our demo shows that de-identification does not make you anonymous: what you talk about, and how you write, still identify you.

Supporting facts:
- A May 2025 order made OpenAI keep consumer logs that users had deleted.
- In 2026, LLM agents with stylometry matched anonymous texts to their authors out of thousands of candidates (SALA, CISPA, Feb 2026; "De-Anonymization at Scale", Jan 2026). Stylometry is the analysis of writing style.
- Agents now *see your screen*. Computer-use agents and AI browsers send full screenshots (bank balances, messages, ID numbers) to the model provider on every step.

## What already exists, and the gap we fill

| Existing tool | What it does | What it does not do |
| --- | --- | --- |
| Caviard, PII Shield, PiiBlocker, ChatWall (browser extensions) | Mask names, emails, and numbers in chatbot prompts | Context clues, writing style, agents, screenshots, files |
| PrivAiTe, OpenObscure, AgentRedactor, og-local (open-source proxies, mostly for developers) | Reversible redaction of API calls, some multimodal | Consumer chat UIs, context and style risk, action-time restore |
| Privacy Mask, screenpipe pii-image-redactor, WebPII/WebRedact (ICLR 2026) | Redact screenshots for agents | Consistent surrogates across steps, typing the real value back in |
| 1Password Secure Agentic Autofill (Oct 2025) | The agent logs in without seeing the password | Any personal data other than passwords |
| Presidio, GLiNER2-PII (0.3B), OpenAI Privacy Filter (Apr 2026) | PII detection models (building blocks) | A product |

**The gap, in one sentence:** every existing tool removes *fields* (a name, an email). None of them measures or removes what makes you identifiable *in combination* (your school, your sister's job, your diagnosis, your writing style). None of them lets an agent use all of your personal data without seeing it.

## How it works

```
 you / your files / your screen
            │
   ┌────────▼─────────────────────────────── on your machine ───┐
   │ 1. DETECT   regex + small NER model + small local LLM      │
   │             (fields, context clues, writing style)         │
   │ 2. DECIDE   policy per item: keep / generalize / replace   │
   │ 3. REPLACE  consistent stand-ins, realistic and same length│
   │             "Priya → Ana", "GMU → [a university in VA]"    │
   │ 4. RESTYLE  (Unsign) optional style normalizer for text    │
   │             that will be stored or published               │
   │ 5. VAULT    the stand-in ↔ real mapping stays local        │
   └────────┬───────────────────────────────────────────────────┘
            │  only stand-ins leave the machine
            ▼
       any AI provider
            │  reply / next agent action
   ┌────────▼───────────────────────────────────────────────────┐
   │ 6. RESTORE  real values go back into replies               │
   │ 7. ACT      when an agent types or clicks a stand-in, the  │
   │             local layer enters the REAL value itself       │
   │ 8. WIRE VIEW  shows the exact bytes that were sent         │
   └────────────────────────────────────────────────────────────┘
```

**The local model (target: runs on a 2024+ laptop, no GPU required):**
- **Fields:** regex and Presidio-style rules for emails, phone numbers, IDs, keys, and card numbers. Under 5 ms.
- **Entities:** GLiNER2-PII (0.3B parameters) or OpenAI Privacy Filter, for names, places, organizations, and health terms. About 20–60 ms per message on CPU.
- **Context clues:** a small local LLM (about 1–3B parameters, for example Qwen3-1.7B or Gemma 3 1B on Apple MLX). It finds *quasi-identifiers*, which are details that are harmless alone but identifying in combination (school + major + hometown + a relative's employer). It also estimates how many people match the combination. About 150–400 ms.
- **Style (Unsign):** our own authorship model (character n-grams, function words, punctuation habits, plus a style-embedding model such as LUAR). It scores how linkable a text is to the user's known writing, and the rewrite loop lowers that score while a meaning check keeps the meaning.
- **Screens:** OCR plus the same detectors. The detected text is replaced *in the screenshot* with a same-size stand-in, so the layout and click targets stay the same.

## Every place an AI takes input

| Entry point | How Off the Record attaches | MVP? |
| --- | --- | --- |
| Chatbot web apps (ChatGPT, Claude, Gemini) | Browser extension rewrites the outgoing request and restores the reply | **Yes** |
| AI browsers and browser agents (Comet, Atlas, Claude in Chrome) | Extension redacts the DOM and screenshots the agent reads; fills real values at action time | **Yes (one agent)** |
| Computer-use agents (desktop control) | Screenshot redactor plus action-time restore (keyboard injection of the real value) | **Yes (demo case)** |
| Apps and scripts that call AI APIs | Local OpenAI- and Anthropic-compatible endpoint (`localhost`) | Yes (cheap) |
| Coding agents (Claude Code, Cursor, Codex) | Same local endpoint; secrets and `.env` values are never sent | Stretch |
| MCP tools | A wrapping MCP server that redacts tool results before the model sees them | Stretch |
| Files and attachments (PDF, images, documents) | Redact before upload; restore in the answer | Yes |
| Past data (your ChatGPT export) | "Audit" mode: shows what the existing logs reveal about you | **Yes (demo act 1)** |
| Voice | Local speech-to-text, then the same text pipeline | Later |
| Clipboard | Optional: flag personal data when you paste into an AI site | Later |

## Policies (so the AI stays useful)

Redacting everything breaks answers. For example, "When is the GMU add/drop deadline?" needs "GMU". Each item gets one action:
- **Keep:** the task needs it. The user can approve this once ("allow GMU for this chat").
- **Generalize:** "GMU" becomes "a large public university in Virginia". "Fairfax" becomes "a Northern Virginia suburb".
- **Replace:** a consistent stand-in, such as "Priya" → "Ana" and an SSN → `123-45-6789`.
- **Act-only:** the model never sees the value, but an agent can still type it (SSN, card number, address).

---

## Tech demo brainstorm (must be great)

### Concept 1: "The 20 million logs" (the reveal)
1. Take a teammate's **real ChatGPT export** (with consent).
2. "De-identify" it the way the court accepted: names, emails, and phone numbers removed, using Presidio.
3. Our attacker reads the "anonymous" logs and, in about 20 seconds, writes a profile: *"ECE junior at a Virginia public university, from Fairfax, sister works in hospital admin, asked about ADHD meds in March, plays club volleyball"*.
4. The style model then ranks the teammate **#1 of 5,000** public Reddit authors by writing style alone.
5. Run the same logs through Off the Record. The attacker produces only a generic profile, and the teammate ranks **#3,412**.

**Why it lands:** it uses the court's own safeguard and shows that it fails. Every judge has a chat history.

### Concept 2: "The agent filled in my SSN without seeing it"
1. A computer-use agent (Claude computer use, or an open-source agent) is asked to fill in a form: an internship application or a FAFSA-style form.
2. Split screen. **Left:** the user's real screen, with an SSN, home address, and bank balance. **Right:** the screenshot that the AI provider received, with realistic stand-ins in the same places.
3. The agent types `123-45-6789` (the stand-in). Off the Record intercepts the keystrokes and types the **real** SSN into the field.
4. The form is complete and correct, and the provider's logs contain only fake data.

**Why it lands:** it goes beyond redaction. The agent *uses* private data that it never saw. 1Password does this for passwords only; we do it for everything.

### Concept 3: "Live with the judges"
A judge types a personal question into ChatGPT on our shared screen ("my landlord at 4400 University Dr won't fix the heat, what are my rights in Fairfax?"). The **wire view** shows the exact request bytes that leave the laptop, captured with mitmproxy so it is not our app's claim: `"[landlord] at [address_1] … in [a Virginia county]"`. The reply comes back with the real words restored, and it is still useful.

**Why it lands:** it is interactive, live, and verifiable, which answers "why should I trust this?"

### Concept 4: "One switch, every AI"
A 20-second montage of the same protection working across 4 entry points: a ChatGPT chat, a PDF upload of a lease, a coding agent reading `.env`, and an MCP tool result. Each shows the same stand-in ("Ana") for the same person, consistently.

**Why it lands:** it shows breadth and the "every entry point" claim. It is weaker on emotion.

### Concept 5: "Undo the past"
After the act 1 reveal, Off the Record lists the 12 chats that leak the most, and the user deletes them in one click. The demo then shows honestly that the court-ordered copies may already exist, so protection must start before you type.

**Why it lands:** it is honest, and it raises the stakes for acts 2–3. It is risky if judges see deletion as pointless.

### Recommended demo (3 acts, about 2 minutes, with the 30-second cut = Act 1 + Act 2 step 3)
1. **Act 1, the leak (Concept 1):** de-identified logs still identify you (profile plus style rank #1).
2. **Act 2, the shield (Concepts 3 + 4):** a judge types a personal question; the wire view shows the stand-ins; the reply is restored and useful; the montage shows the other entry points.
3. **Act 3, the magic (Concept 2):** the agent fills in the real SSN without seeing it.

**Fallbacks so the demo cannot fail:** record each act ahead of time. Run acts 1 and 3 on cached inputs. Keep the live judge interaction (act 2), because it needs only the local model.

---

## MVP scope (if locked)

**Build first (Wed):**
- The local detector (regex + GLiNER2-PII + small LLM)
- The vault
- The browser extension for ChatGPT and Claude
- The audit mode on a ChatGPT export
- The wire view
- The style score

**Build second (Wed–Thu):**
- The computer-use screenshot redactor
- Action-time restore for one agent and one form
- The local API endpoint

**Stretch:**
- An MCP wrapper
- Coding-agent secrets
- Voice

## Honest risks

1. **"Isn't this just a PII redactor?"** That is the biggest judging risk. The answer must show on screen: context and style (act 1) and action-time restore (act 3). Field masking alone is not new.
2. **Utility loss.** Stand-ins can break answers. Mitigation: the keep / generalize / replace policy, plus a test of 30 real prompts with a quality comparison.
3. **Detection misses.** The small model will miss some clues. The wire view makes misses visible, which is honest but can embarrass a live demo. Cache the demo inputs.
4. **Screenshot redaction for agents is hard.** Stand-in text must fit the same box, and the agent must keep working on altered screens. WebPII research shows that it can be done. Test on one agent and one form only.
5. **Platform changes.** ChatGPT's page structure changes often. Use request interception (fetch hooks), not DOM scraping, where possible.
6. **Style rewriting changes the user's words.** Use it only for text that will be stored or published, and make it a user choice.

## First tests (cheap, before locking; total about $1)

1. **The reveal works (30 min):** de-identify one teammate's export with Presidio, then ask a frontier model (one call, about $0.10) to profile the person. **Pass:** the profile contains ≥ 3 true quasi-identifiers.
2. **The style rank works (1 hour, free and local):** rank the teammate's text against 5,000 Reddit authors (Pushshift-style public data) with a character n-gram model. **Pass:** the teammate is in the top 10.
3. **Utility holds (1 hour, about $0.50):** 30 real prompts, sent raw and with stand-ins. **Pass:** ≥ 25 of 30 answers are judged equally useful.
4. **Action-time restore (2 hours):** one agent fills one web form through stand-ins. **Pass:** the form ends with the real values, and the model's transcript has only stand-ins.

## Open questions for Adarsh

1. Which act is the 30-second judge moment: the reveal (act 1) or the agent filling in the SSN (act 3)?
2. How should the product name and framing work: "privacy firewall for AI", or "AI that forgets you"?
3. Should style rewriting (Unsign) apply to chats, or only to text that will be published?
4. Desktop app (it can see every entry point) or browser extension only (simpler, but no computer-use agents)?
5. Is the local model fast enough on the team's slowest laptop? That decides the model size.
6. Who on the team has a real ChatGPT export they would agree to use in act 1?

## Sources

- [National Law Review: court affirms order for 20M ChatGPT logs](https://natlawreview.com/article/when-chats-become-evidence-court-affirms-order-requiring-openai-produce-20-million)
- [Pearl Cohen / Data Privacy and Security Insider on the order](https://www.dataprivacyandsecurityinsider.com/2026/01/when-chats-become-evidence-court-affirms-order-requiring-openai-to-produce-20-million-de-identified-chatgpt-logs/)
- [SALA: stylometry-assisted LLM deanonymization (arXiv 2602.23079)](https://arxiv.org/abs/2602.23079)
- [De-Anonymization at Scale (arXiv 2601.12407)](https://arxiv.org/html/2601.12407v1)
- [1Password: closing the credential risk gap for browser AI agents](https://1password.com/blog/closing-the-credential-risk-gap-for-browser-use-ai-agents)
- [Browserbase and 1Password agentic autofill](https://browserbase.com/blog/1password-agentic-autofill)
- [PrivAiTe (PyPI)](https://pypi.org/project/privaite/0.4.0/)
- [OpenObscure](https://dev.to/srianant/openobscure-open-source-on-device-privacy-firewall-for-ai-agents-2gk6)
- [AgentRedactor](https://github.com/Negative-Star-Innovators/AgentRedactor)
- [og-local](https://gentic.news/article/og-local-the-local-privacy-proxy)
- [Privacy Mask (screenshots)](https://aiproductivity.ai/news/privacy-mask-redacts-screenshots-ai-agents/)
- [screenpipe privacy filter](https://docs.screenpi.pe/privacy-filter)
- [ScreenLeak](https://screenpipe.github.io/screenleak/)
- [WebPII (ICML 2026 listing)](https://icml.cc/virtual/2026/67794)
- [Mobile GUI agent privacy layer (arXiv 2603.17357)](https://arxiv.org/abs/2603.17357)
- [GLiNER2-PII (arXiv 2605.09973)](https://arxiv.org/html/2605.09973)
- [OpenAI Privacy Filter overview (Grepture)](https://grepture.com/blog/openai-privacy-filter-pii-redaction)
- [Elephas: ChatGPT anonymizer tools](https://elephas.app/resources/best-chatgpt-anonymizer-tools)
