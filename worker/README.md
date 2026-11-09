# Optional API proxy (Cloudflare Worker)

Static GitHub Pages cannot hide keys or fully shield Nominatim/Overpass rate limits.  
Deploy this worker if you want a same-origin proxy.

## What it does

`GET /?url=<encoded upstream URL>` fetches the upstream URL server-side and returns the body with CORS headers for your Pages origin.

## Deploy

1. Create a Worker in the Cloudflare dashboard (or `npx wrangler deploy`).
2. Paste `src/index.js`.
3. Set env `VITE_API_PROXY=https://your-worker.example.workers.dev` at **build time** for the web app (`vite` reads it into the client).

## Security notes

- Restrict allowed hostnames (already limited in the sample).
- Do **not** put Google/NREL secret keys in the public Vite bundle; keep BYO keys in `localStorage` or terminate them only on a private backend.
