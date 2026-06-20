import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionFromHeaders } from "@/lib/auth/session";
import { UsersClient } from "./users-client";

export const dynamic = "force-dynamic";

// Admin-only user management. The middleware forwards x-user-* on the request
// headers; we read them here for a server-side gate (defense in depth — the
// /api/users routes also independently re-check the role).
export default async function AdminUsersPage() {
  const requestHeaders = await headers();
  const session = getSessionFromHeaders(requestHeaders as unknown as Headers);
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/");
  return <UsersClient currentUserId={session.userId} />;
}
