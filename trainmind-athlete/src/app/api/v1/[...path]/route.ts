import { NextRequest, NextResponse } from 'next/server';

const TARGET = process.env.API_INTERNAL_URL || 'http://localhost:3001';
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

  let bodyText: string | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    bodyText = await req.text();
    outHeaders.delete('content-length');
  }

  const init: RequestInit = {
    method: req.method,
    headers: outHeaders,
    redirect: 'manual',
    cache: 'no-store',
    body: bodyText,
  };

  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: { code: 'PROXY_ERROR', message: `Cannot reach API: ${(err as Error).message}` } },
      { status: 502 },
    );
  }

  const inHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (['content-encoding', 'transfer-encoding', 'connection', 'keep-alive'].includes(k)) return;
    inHeaders.set(key, value);
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: inHeaders,
  });
}

export async function GET(req: NextRequest, ctx: { params: { path: string[] } }) { return proxy(req, ctx); }
export async function POST(req: NextRequest, ctx: { params: { path: string[] } }) { return proxy(req, ctx); }
export async function PUT(req: NextRequest, ctx: { params: { path: string[] } }) { return proxy(req, ctx); }
export async function PATCH(req: NextRequest, ctx: { params: { path: string[] } }) { return proxy(req, ctx); }
export async function DELETE(req: NextRequest, ctx: { params: { path: string[] } }) { return proxy(req, ctx); }

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
