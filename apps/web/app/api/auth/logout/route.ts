import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  destroySession(res);
  return res;
}
