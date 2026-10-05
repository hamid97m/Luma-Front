// Vercel Edge Function: GET /api/geo → { country: "IR" | ... | null }
//
// Echoes Vercel's geo header so the first-open language picker can preselect
// Persian/Arabic for users whose Telegram runs in English. Ships with the
// frontend (same origin); `vercel.json`'s SPA rewrite does not apply to
// function routes, so this path is reachable without further config.

export const config = { runtime: 'edge' }

export default function handler(req: Request): Response {
  const raw = req.headers.get('x-vercel-ip-country')
  const country = raw && /^[A-Za-z]{2}$/.test(raw) ? raw.toUpperCase() : null
  return new Response(JSON.stringify({ country }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Per-visitor answer — never let a CDN or the WebView cache it.
      'cache-control': 'private, no-store',
    },
  })
}
