import { NextResponse, type NextRequest } from "next/server";
import { isPublicRequest } from "@/lib/access-policy";
import { isUnlocked } from "@/lib/server-auth";

/**
 * 비밀번호 잠금 (2026-11-04, Funnel 공개). 열어두는 경로는 lib/access-policy.ts.
 * 잠긴 화면은 /unlock으로 보내고(돌아갈 곳을 next에 실어), API는 401로 끊는다.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicRequest(request.method, pathname)) return NextResponse.next();
  if (isUnlocked(request)) return NextResponse.next();

  // API는 리다이렉트하면 클라이언트가 HTML을 받게 되니 401로 끊는다.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "비밀번호가 필요해요" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = "";
  const target = `${pathname}${search}`;
  if (target.startsWith("/") && !target.startsWith("//")) {
    url.searchParams.set("next", target);
  }
  return NextResponse.redirect(url);
}

export const config = {
  // node:crypto를 쓰므로 Node 런타임에서 돈다.
  runtime: "nodejs",
  // 정적 자산은 통과 — 잠금 화면 자체가 CSS·JS를 받아야 그려진다.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
