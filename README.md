# NFL Strat-O-Matic 2008 (GitHub Pages Ready)

This repo contains both source code (`packages/*`) and a prebuilt static app in `dist/` so you can drag-and-drop to GitHub and go live.

## Quick Deploy (no build required)
1. Create a new empty repo on GitHub.
2. Upload the **contents of this folder** (including `dist/`, `data/`, `assets/`, etc.).
3. In **Settings → Pages**, set source = `main` branch, folder = `/ (root)`.
4. Visit your Pages URL. The root `index.html` redirects to `dist/index.html`.

## Local Dev
```bash
npm install
npm run dev
# edit under packages/app and packages/engine
npm run build   # if you want to regenerate dist/
```

## Notes
- Team dropdown loads all 32 teams from `data/2008/team-meta.json`.
- Player cards are resolved via `data/2008/sample-teams.json` → IDs mapped to `data/2008/sample-cards.json`.
- Field graphic is `assets/field.svg`. Replace with your own if desired.


## 🔐 Admin Login (in-browser, not secure)
- **User:** `JNWILLIS`
- **Password:** `Duke2010!`
Use the **Admin** button in the header to open the editor. Changes are stored in your browser `localStorage` and can be **Exported** as `sample-cards.json` to commit back into `/dist/data/` (and your source). For real auth, use a backend — this is purely static/demo.
