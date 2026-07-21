// ============================================================
// API proxy catch-all
// Sostituisce le rewrites di next.config.mjs per poter strippare
// gli header del browser (Origin/Host/Referer) che farebbero
// fallire la check CORS del backend trainmind-app.
// Funziona per qualsiasi metodo HTTP e path sotto /api/v1/*.
// ============================================================
import { NextRequest, NextResponse } from 'next/server';

const TARGET = process.env.API_INTERNAL_URL || 'http://localhost:3001';

// Strip solo gli header che farebbero fallire la check CORS o confonderebbero
// la pipeline HTTP a valle. Tutto il resto (Authorization, Content-Type, ...)
// passa intatto.
const STRIP = new Set(['host', 'origin', 'referer']);

async function proxy(
  req: NextRequest,
  ctx: { params: { path: string[] } },
): Promise<NextResponse> {
  const path = ctx.params.path?.join('/') ?? '';
  const url = `${TARGET}/api/v1/${path}${req.nextUrl.search}`;

  const outHeaders = new Headers();
  req.headers.forEach((value, key) => {
    if (!STRIP.has(key.toLowerCase())) outHeaders.set(key, value);
  });

  // Read body as text. JSON endpoints expect a string body anyway, e fetch
  // gestisce Content-Length da solo quando il body e' una stringa.
  let bodyText: string | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    bodyText = await req.text();
    // Rimuovi un eventuale content-length ereditato dal browser: ora il body
    // potrebbe avere lunghezza diversa (encoding), fetch ne ricalcola uno nuovo.
    outHeaders.delete('content-length');
  }

  const init: RequestInit = {
    method: req.method,
    headers: outHeaders,
    redirect: 'manual',
    cache: 'no-store',
    body: bodyText,
  };

  // Log lato server per debug — visibile nel terminale di trainmind-mobile
  console.log(`[proxy] ${req.method} ${url} body=${(bodyText ?? '').slice(0, 120)}`);

  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch (err) {
    console.error('[proxy] fetch error:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PROXY_ERROR',
          message: `Cannot reach API at ${TARGET}. Is the trainmind-app backend running on port 3001? ${(err as Error).message}`,
        },
      },
      { status: 502 },
    );
  }

  console.log(`[proxy] -> ${upstream.status} ${upstream.statusText}`);

  // Rebuild response, dropping hop-by-hop / encoding headers
  const inHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (
      k === 'content-encoding' ||
      k === 'transfer-encoding' ||
      k === 'connection' ||
      k === 'keep-alive'
    )
      return;
    inHeaders.set(key, value);
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: inHeaders,
  });
}

export async function GET(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx);
}
export async function POST(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx);
}
export async function PUT(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx);
}
export async function PATCH(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx);
}
export async function DELETE(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx);
}
export async function OPTIONS(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx);
}
export async function HEAD(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx);
}

// Disable static optimization — must run on every request
export const dynamic = 'force-dynamic';
// Use Node.js runtime (default) for full fetch + buffer support
export const runtime = 'nodejs';
