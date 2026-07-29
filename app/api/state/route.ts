import { ensureSurveySchema, getDatabase } from "../../../db/turso";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const db = getDatabase();
    await ensureSurveySchema(db);
    const result = await db.execute(
      "SELECT voting_open, results_public FROM site_state WHERE id = 1",
    );
    const row = result.rows[0];

    return Response.json(
      {
        votingOpen: Boolean(row?.voting_open),
        resultsPublic: Boolean(row?.results_public),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Survey status is unavailable." },
      { status: 500 },
    );
  }
}
