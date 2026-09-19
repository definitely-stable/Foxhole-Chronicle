import createMiddleware from "next-intl/middleware";
import type {NextRequest} from "next/server";
import {NextResponse} from "next/server";
import {isSupportedLocale, negotiateLocale} from "./i18n/negotiation";
import {routing} from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const firstSegment = request.nextUrl.pathname.split("/")[1];

  // An explicit supported locale in the URL is authoritative.
  if (isSupportedLocale(firstSegment)) {
    return intlMiddleware(request);
  }

  const remembered = request.cookies.get("CHRONICLE_LOCALE")?.value;
  const locale = isSupportedLocale(remembered)
    ? remembered
    : negotiateLocale(request.headers.get("accept-language"));

  const target = request.nextUrl.clone();
  target.pathname =
    request.nextUrl.pathname === "/"
      ? `/${locale}`
      : `/${locale}${request.nextUrl.pathname}`;

  return NextResponse.redirect(target);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"]
};
