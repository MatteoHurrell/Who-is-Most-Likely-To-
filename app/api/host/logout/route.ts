import { clearHostSession } from "../../../../lib/host-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  await clearHostSession();
  return Response.json({ ok: true });
}
