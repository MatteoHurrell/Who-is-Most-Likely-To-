import {
  createHostSession,
  pinsMatch,
} from "../../../../lib/host-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { pin?: unknown };
    const hostPin = process.env.HOST_PIN;

    if (
      typeof payload.pin !== "string" ||
      !hostPin ||
      !pinsMatch(payload.pin, hostPin)
    ) {
      return Response.json(
        { error: "The host PIN is incorrect." },
        { status: 401 },
      );
    }

    await createHostSession();
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: "Host access is unavailable." },
      { status: 500 },
    );
  }
}
