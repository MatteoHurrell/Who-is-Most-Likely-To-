import { ensureSurveySchema, getDatabase } from "../../../../db/turso";
import { isHostAuthenticated } from "../../../../lib/host-auth";
import { getResults } from "../../../../lib/results";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await isHostAuthenticated())) {
    return Response.json({ error: "Host access required." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const dataset = url.searchParams.get("dataset") === "test" ? "test" : "real";
    const db = getDatabase();
    await ensureSurveySchema(db);
    const results = await getResults(db, dataset);
    return Response.json(
      { results, dataset },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Results are unavailable." },
      { status: 500 },
    );
  }
}
