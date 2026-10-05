// Vercel Function: GET /api/geo → { country: "IR" | ... | null }
//
// Echoes Vercel's geo header so the first-open language picker can preselect
// Persian/Arabic for users whose Telegram runs in English. Ships with the
// frontend (same origin); `vercel.json`'s SPA rewrite does not apply to
// function routes.
//
// Deliberately plain JS on the default Node.js runtime with the Web-standard
// handler signature — the most portable shape Vercel builds zero-config, with
// no dependency on the project's tsconfig or the (deprecated) edge runtime.

/** @param {Request} request */
export function GET(request) {
  const raw = request.headers.get('x-vercel-ip-country')
  const country = raw && /^[A-Za-z]{2}$/.test(raw) ? raw.toUpperCase() : null
  return new Response(JSON.stringify({ country }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Per-visitor answer — never let a CDN or the WebView cache it.
      'cache-control': 'private, no-store',
    },
  })
}
