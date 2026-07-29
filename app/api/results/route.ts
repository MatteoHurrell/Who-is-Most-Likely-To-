import { ensureSurveySchema, getDatabase } from "../../../db/turso";
import { pinsMatch } from "../../../lib/host-auth";
import { getResults } from "../../../lib/results";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function loadRealResults() {
  const db = getDatabase();
  await ensureSurveySchema(db);
  return { db, results: await getResults(db, "real") };
}

export async function GET() {
  try {
    const { db, results } = await loadRealResults();
    const stateResult = await db.execute(
      "SELECT results_public FROM site_state WHERE id = 1",
    );
    if (!Boolean(stateResult.rows[0]?.results_public)) {
      return Response.json(
        { error: "Results are locked." },
        { status: 403, headers: { "cache-control": "no-store" } },
      );
    }

    return Response.json(
      { results, access: "public" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Results are unavailable." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { pin?: unknown };
    const resultsPin = process.env.RESULTS_PIN;

    if (
      typeof payload.pin !== "string" ||
      !resultsPin ||
      !pinsMatch(payload.pin, resultsPin)
    ) {
      return Response.json(
        { error: "The PIN is incorrect." },
        { status: 401, headers: { "cache-control": "no-store" } },
      );
    }

    const { results } = await loadRealResults();
    return Response.json(
      { results, access: "private" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Results are unavailable." },
      { status: 500 },
    );
  }
}
