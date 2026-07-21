// ============================================================
// AI service proxy catch-all
// Inoltra /api/ai-svc/<path> al container ai-service (FastAPI)
// strippando Origin/Host/Referer (evita CORS) e gestendo SSE.
// ============================================================
import { NextRequest, NextResponse } from 'next/server';

const TARGET = process.env.AI_INTERNAL_URL || 'http://localhost:3002';

const STRIP = new Set(['host', 'origin', 'referer']);

async function proxy(
  req: NextRequest,
  ctx: { params: { path: string[] } },
): Promise<Response> {
  const path = ctx.params.path?.join('/') ?? '';
  const url = `${TARGET}/${path}${req.nextUrl.search}`;

  const outHeaders = new Headers();
  req.headers.forEach((value, key) => {
    if (!STRIP.has(key.toLowerCase())) outHeaders.set(key, value);
  });

  let bodyText: string | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    bodyText = await req.text();
    outHeaders.delete('content-length');
  }

  console.log(`[ai-proxy] ${req.method} ${url}`);

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: req.method,
      headers: outHeaders,
      body: bodyText,
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch (err) {
    console.error('[ai-proxy] fetch error:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'AI_PROXY_ERROR',
          message: `Cannot reach AI service at ${TARGET}. Is the ai-service container running on port 3002? ${(err as Error).message}`,
        },
      },
      { status: 502 },
    );
  }

  console.log(`[ai-proxy] -> ${upstream.status} ${upstream.statusText}`);

  // For SSE / streaming responses, pass the body stream through unchanged.
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

  return new Response(upstream.body, {
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

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
