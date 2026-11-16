---
name: ste
description: Explain technical ideas in Standard Technical English, which is clear, literal, and free of jargon. Use whenever an explanation, README, spec, Devpost write-up, or pitch is confusing, vague, or full of AI-style filler, or when the user asks for STE or a plain explanation.
---

# Standard Technical English (STE)

Based on Johnathan Mo's `/ste` (jmo-skills, MIT). This version adds the banned-word list he describes in the video and a rewrite check. It follows the goals of ASD-STE100 but does not claim formal compliance.

The reader must understand the text on the first read, and it must stay technically correct.

## Rules

1. Start with what the thing does and why it matters. Explain how it works after that.
2. One idea per sentence. Aim for 20 words or fewer in a procedural sentence and 25 or fewer in a descriptive one.
3. Use the active voice and name the actor: "The server sends the token", not "The token is sent".
4. Use common, concrete words. Keep a technical term only when it is the correct term. Define it the first time you use it, and spell out each acronym the first time.
5. Use one word for one meaning. Once you call something a "job", do not call it a "task" later.
6. Write steps in the order they happen, as a numbered list with one action per step.
7. State cause and effect directly: "X happens because Y" or "If X, then Y".
8. Keep three things separate: what is confirmed, what is assumed, and what you recommend.
9. When an idea is abstract, give a short, concrete example.
10. Use exact numbers and names. Write "takes 2–3 s on a 1,000-row table", not "is a bit slow".

## Banned words and phrases

Do not use these. Replace each with the literal thing it stands for.

| Banned | Write instead |
| --- | --- |
| lever, knob, dial, toggle (as metaphors) | the actual setting, parameter, or decision |
| counterfactual | "if we had not done X, then Y" |
| surface (as a verb), unlock, unpack, double-click on | show, enable, explain, look at |
| leverage, utilize | use |
| robust, seamless, powerful, cutting-edge, game-changing | the specific property: "retries 3 times", "works offline" |
| delve, dive into, deep dive | look at, explain, test |
| at the end of the day, it's worth noting, importantly | (delete) |
| orthogonal, load-bearing, first-class, primitives (non-technical use) | independent, required, built-in, basic parts |
| tapestry, landscape, ecosystem, journey, paradigm | the actual set of things |
| "This isn't X, it's Y" framing; rhetorical questions | a direct statement |

## Check before you finish

- Every pronoun has one clear referent.
- Every technical term is defined, or the reader already knows it.
- Every step says what changes and why.
- No banned word is left. Search your draft for them.
- If a detail is uncertain, say what is unknown and what would confirm it.

Do not make the text less accurate just to make it shorter.
