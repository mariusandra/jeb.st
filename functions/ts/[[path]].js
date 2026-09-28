// Cloudflare Pages Function: forwards /ts/* to TypeSafe's API so the browser can use its own key.
//
// api.typesafe.ai does not allow cross-origin browser calls, so the page cannot post to it directly. This hop runs on
// Cloudflare's edge, passes the request through unchanged (method, path, JSON body, the caller's Authorization header)
// and returns the answer with CORS headers for this site. Keys are neither stored nor logged here.
const UPSTREAM = "https://api.typesafe.ai";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "authorization, content-type", "access-control-max-age": "86400" };

export async function onRequest({ request, params }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const path = Array.isArray(params.path) ? params.path.join("/") : (params.path || "");
  const url = new URL(request.url);
  const target = `${UPSTREAM}/${path}${url.search}`;
  const headers = { accept: "application/json" };
  const auth = request.headers.get("authorization"); if (auth) headers.authorization = auth;
  const ctype = request.headers.get("content-type"); if (ctype) headers["content-type"] = ctype;
  let upstream;
  try {
    upstream = await fetch(target, { method: request.method, headers, body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer() });
  } catch (e) {
    return new Response(JSON.stringify({ detail: `relay could not reach ${UPSTREAM}: ${e.message}` }), { status: 502, headers: { ...CORS, "content-type": "application/json" } });
  }
  const out = new Headers(CORS);
  out.set("content-type", upstream.headers.get("content-type") || "application/json");
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
