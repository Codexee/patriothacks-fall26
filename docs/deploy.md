# Deploy (Vercel)

The app is a static Vite build plus one serverless function (`app/api/eia.ts`) for the live page.

## One-time setup (needs a person with a Vercel account)

1. Get a free EIA API key: https://www.eia.gov/opendata/register.php
2. Install and log in:
   ```bash
   npm i -g vercel
   vercel login
   ```
3. From the repository root, link the project with **`app/` as the root directory**:
   ```bash
   cd app && vercel link
   ```
4. Add the key to the project (Production and Preview):
   ```bash
   vercel env add EIA_API_KEY
   ```

## Deploy

```bash
cd app && vercel --prod
```

## Check after each deploy (private window, then a phone)

| Page | What must work |
| --- | --- |
| `/#/` | The county map draws; the three hero events are listed |
| `/#/?story=texas2021` | Story mode plays to the end with no input |
| `/#/hollow/ERCO-2021021501` | The cross-section and the clock |
| `/#/evidence` | The cards, the chart, the event table, both downloads |
| `/#/brief/48201` | The Harris County brief; print preview is one page |
| `/#/live` | "Live" data for ERCO. If it says "cached" or "not available", check `EIA_API_KEY` |
| `/api/eia?ba=ERCO` | JSON with `source: "eia"` (status 503 means the key is missing) |

## Notes

- Without the key, everything except the live page still works; the live page shows a saved sample and says so.
- `app/public/data/v1` is about 14 MB (about 2 MB compressed in transit). Rebuild it with `cd data && uv run python build/export_app.py`.
- Never commit the key. Local use: put `EIA_API_KEY=...` in `.env.local` and run `vercel dev` inside `app/`.
