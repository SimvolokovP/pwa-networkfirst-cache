import { withPWA } from "next-pwa-pack";
import { NextRequest, NextResponse } from 'next/server';

async function originalMiddleware(request: NextRequest) {
  // Просто пропускаем запрос дальше без изменений
  return NextResponse.next();
}

export default withPWA(originalMiddleware, {
  revalidationSecret: "SECRET",
  sseEndpoint: "/api/pwa/cache-events",
  webhookPath: "/api/pwa/revalidate",
});

export const config = {
  matcher: ["/", "/(ru|en)/:path*", "/api/pwa/:path*"],
};