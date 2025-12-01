import { NextResponse, type NextRequest } from "next/server";

const STAGING_HOSTS = new Set(["staging.wineacademy.de", "staging.wineacademy.com"]);

function unauthorized(): NextResponse {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Staging", charset="UTF-8"',
      "X-Robots-Tag": "noindex, nofollow, noarchive"
    }
  });
}

export function middleware(request: NextRequest) {
  const headerHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const hostname = (headerHost ?? request.nextUrl.hostname).toLowerCase().split(":")[0];

  if (!STAGING_HOSTS.has(hostname)) {
    return NextResponse.next();
  }

  const user = process.env.STAGING_BASIC_AUTH_USER;
  const pass = process.env.STAGING_BASIC_AUTH_PASS;

  if (!user || !pass) {
    return new NextResponse("Staging Basic Auth ist nicht konfiguriert", {
      status: 503,
      headers: {
        "Retry-After": "300",
        "X-Robots-Tag": "noindex, nofollow, noarchive"
      }
    });
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Basic ")) {
    return unauthorized();
  }

  let decoded = "";
  try {
    decoded = atob(authHeader.split(" ")[1] ?? "");
  } catch {
    return unauthorized();
  }

  const [incomingUser, ...rest] = decoded.split(":");
  const incomingPass = rest.join(":");

  if (incomingUser !== user || incomingPass !== pass) {
    return unauthorized();
  }

  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/.*|api/.*|uploads/.*).*)"]
};
