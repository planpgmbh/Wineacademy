import { NextRequest, NextResponse } from "next/server";

const targetBase = process.env.API_PROXY_TARGET;

function normaliseBase(url: string): string {
  return url.replace(/\/+$/, "");
}

function buildTargetUrl(request: NextRequest, params: { path?: string[] }): URL {
  if (!targetBase) {
    throw new Error("API_PROXY_TARGET ist nicht gesetzt.");
  }

  const baseUrl = new URL(normaliseBase(targetBase));
  const pathnameParts: string[] = [];

  if (baseUrl.pathname && baseUrl.pathname !== "/") {
    pathnameParts.push(baseUrl.pathname.replace(/^\/+/, ""));
  }

  if (params.path?.length) {
    pathnameParts.push(
      ...params.path.map((segment) => encodeURIComponent(segment))
    );
  }

  const targetUrl = new URL(request.url);
  const mergedPath = pathnameParts.join("/");
  targetUrl.protocol = baseUrl.protocol;
  targetUrl.hostname = baseUrl.hostname;
  targetUrl.port = baseUrl.port ?? "";
  targetUrl.host = targetUrl.port ? `${targetUrl.hostname}:${targetUrl.port}` : targetUrl.hostname;
  targetUrl.pathname = mergedPath ? `/${mergedPath}` : baseUrl.pathname || "/";

  return targetUrl;
}

async function proxyRequest(request: NextRequest, params: { path?: string[] }): Promise<NextResponse> {
  if (!targetBase) {
    return NextResponse.json(
      { error: "Proxy-Konfiguration fehlt (API_PROXY_TARGET nicht gesetzt)." },
      { status: 500 }
    );
  }

  const targetUrl = buildTargetUrl(request, params);

  const headers = new Headers(request.headers);
  headers.set("host", targetUrl.host);
  headers.delete("content-length");

  const hasBody = !["GET", "HEAD"].includes(request.method);
  const body = hasBody ? await request.arrayBuffer() : undefined;

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
    redirect: "manual",
    cache: "no-store"
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-security-policy");

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  });
}

export const runtime = "nodejs";

async function resolveContext(
  context: unknown
): Promise<{ path?: string[] }> {
  const resolved = await context;
  if (
    resolved &&
    typeof resolved === "object" &&
    "params" in resolved &&
    resolved.params &&
    typeof resolved.params === "object"
  ) {
    const maybeParams = (resolved as { params: unknown }).params;
    const params =
      maybeParams && typeof (maybeParams as Promise<unknown>).then === "function"
        ? await (maybeParams as Promise<{ path?: string[] }>)
        : (maybeParams as { path?: string[] } | undefined);
    return {
      path: params && Array.isArray(params.path) ? params.path : []
    };
  }
  return {};
}

export async function GET(request: NextRequest, context: unknown) {
  const params = await resolveContext(context);
  return proxyRequest(request, params);
}

export async function HEAD(request: NextRequest, context: unknown) {
  const params = await resolveContext(context);
  return proxyRequest(request, params);
}

export async function POST(request: NextRequest, context: unknown) {
  const params = await resolveContext(context);
  return proxyRequest(request, params);
}

export async function PUT(request: NextRequest, context: unknown) {
  const params = await resolveContext(context);
  return proxyRequest(request, params);
}

export async function PATCH(request: NextRequest, context: unknown) {
  const params = await resolveContext(context);
  return proxyRequest(request, params);
}

export async function DELETE(request: NextRequest, context: unknown) {
  const params = await resolveContext(context);
  return proxyRequest(request, params);
}

export async function OPTIONS(request: NextRequest, context: unknown) {
  const params = await resolveContext(context);
  return proxyRequest(request, params);
}
