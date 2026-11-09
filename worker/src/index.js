/**
 * Minimal CORS proxy for allowlisted geospatial APIs.
 * Deploy with Cloudflare Workers / wrangler.
 */
const ALLOW = [
  "nominatim.openstreetmap.org",
  "overpass-api.de",
  "overpass.kumi.systems",
  "overpass.openstreetmap.ru",
  "services.arcgis.com",
  "server.arcgisonline.com",
];

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "*";
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: cors(origin),
      });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get("url");
    if (!target) {
      return json({ error: "Missing ?url=" }, 400, origin);
    }

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return json({ error: "Invalid url" }, 400, origin);
    }

    if (!ALLOW.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`))) {
      return json({ error: "Host not allowlisted" }, 403, origin);
    }

    const upstream = await fetch(parsed.toString(), {
      method: request.method,
      headers: {
        Accept: request.headers.get("Accept") || "application/json",
        "User-Agent": "HometownSolarSavingsProxy/1.0",
      },
      body: request.method === "POST" ? await request.text() : undefined,
    });

    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...cors(origin),
        "Content-Type":
          upstream.headers.get("Content-Type") || "application/json",
        "Cache-Control": "public, max-age=120",
      },
    });
  },
};

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Accept",
  };
}

function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });
}
