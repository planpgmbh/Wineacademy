import { NextResponse } from "next/server";

const STAGING_HOSTS = new Set(["staging.wineacademy.de", "staging.wineacademy.com"]);

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const headerHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const hostname = (headerHost ?? new URL(request.url).hostname).toLowerCase().split(":")[0];
  const isStaging = STAGING_HOSTS.has(hostname);

  const body = isStaging ? "User-agent: *\nDisallow: /\n" : "User-agent: *\nAllow: /\n";
  const response = new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": isStaging ? "public, max-age=300" : "public, max-age=86400"
    }
  });

  if (isStaging) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  return response;
}
