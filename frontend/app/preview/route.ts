import { draftMode } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const PREVIEW_SECRET = process.env.PREVIEW_SECRET ?? process.env.ADMIN_JWT_SECRET ?? "";

function resolveExternalOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto ?? "https"}://${forwardedHost}`;
  }
  return request.nextUrl.origin;
}

function buildRedirectUrl(
  request: NextRequest,
  slug: string,
  status: "draft" | "published",
  documentId: string
) {
  const target = new URL(resolveExternalOrigin(request));
  target.pathname = `/${encodeURIComponent(slug)}`;
  target.searchParams.set("preview", "true");
  target.searchParams.set("status", status);
  target.searchParams.set("documentId", documentId);
  return target;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const secret = searchParams.get("secret");
  const type = searchParams.get("type");
  const documentId = searchParams.get("documentId");
  const slug = searchParams.get("slug");
  const status = searchParams.get("status") === "published" ? "published" : "draft";

  if (!PREVIEW_SECRET || secret !== PREVIEW_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (type !== "landingpage") {
    return new NextResponse("Unsupported preview type", { status: 400 });
  }

  if (!documentId || !slug) {
    return new NextResponse("Missing preview parameters", { status: 400 });
  }

  const draft = await draftMode();
  draft.enable();

  const redirectUrl = buildRedirectUrl(request, slug, status, documentId);
  return NextResponse.redirect(redirectUrl);
}

export const runtime = "nodejs";
