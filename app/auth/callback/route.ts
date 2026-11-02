import { NextResponse, type NextRequest } from "next/server";
import { authCallbackRedirectUrl, safeAuthDestination } from "@/lib/auth-destination";

export async function GET(request: NextRequest) {
  const destination = safeAuthDestination(request.nextUrl.searchParams.get("next"));
  const signupConfirmation = request.nextUrl.searchParams.get("flow") === "signup";
  return NextResponse.redirect(authCallbackRedirectUrl(request.url, destination, signupConfirmation));
}
