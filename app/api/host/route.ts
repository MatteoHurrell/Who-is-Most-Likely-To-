import { ensureSurveySchema, getDatabase } from "../../../db/turso";
import { isHostAuthenticated } from "../../../lib/host-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HostAction =
  | "publish_results"
  | "hide_results"
  | "open_voting"
  | "close_voting"
  | "reset_test_data"
  | "delete_real_ballots"
  | "restore_real_ballots";

async function getHostState() {
  const db = getDatabase();
  await ensureSurveySchema(db);
  const [stateResult, liveResult, testResult, archiveResult] = await Promise.all([
    db.execute(
      "SELECT voting_open, results_public, updated_at FROM site_state WHERE id = 1",
    ),
    db.execute("SELECT COUNT(*) AS count FROM submissions"),
    db.execute("SELECT COUNT(*) AS count FROM test_submissions"),
    db.execute(
      "SELECT COUNT(*) AS batches, COALESCE(SUM(ballot_count), 0) AS ballots FROM archive_batches",
    ),
  ]);

  const state = stateResult.rows[0];
  return {
    votingOpen: Boolean(state?.voting_open),
    resultsPublic: Boolean(state?.results_public),
    liveBallots: Number(liveResult.rows[0]?.count ?? 0),
    testBallots: Number(testResult.rows[0]?.count ?? 0),
    archiveBatches: Number(archiveResult.rows[0]?.batches ?? 0),
    archivedBallots: Number(archiveResult.rows[0]?.ballots ?? 0),
    updatedAt: Number(state?.updated_at ?? 0),
  };
}

export async function GET() {
  if (!(await isHostAuthenticated())) {
    return Response.json({ error: "Host access required." }, { status: 401 });
  }

  try {
    return Response.json(await getHostState(), {
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Host controls are unavailable." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await isHostAuthenticated())) {
    return Response.json({ error: "Host access required." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as {
      action?: HostAction;
      confirmation?: string;
    };
    const db = getDatabase();
    await ensureSurveySchema(db);
    const now = Date.now();

    switch (payload.action) {
      case "publish_results":
        await db.execute({
          sql: "UPDATE site_state SET results_public = 1, voting_open = 0, updated_at = ? WHERE id = 1",
          args: [now],
        });
        break;
      case "hide_results":
        await db.execute({
          sql: "UPDATE site_state SET results_public = 0, updated_at = ? WHERE id = 1",
          args: [now],
        });
        break;
      case "open_voting":
        await db.execute({
          sql: "UPDATE site_state SET voting_open = 1, results_public = 0, updated_at = ? WHERE id = 1",
          args: [now],
        });
        break;
      case "close_voting":
        await db.execute({
          sql: "UPDATE site_state SET voting_open = 0, updated_at = ? WHERE id = 1",
          args: [now],
        });
        break;
      case "reset_test_data":
        await db.batch([
          { sql: "DELETE FROM test_votes", args: [] },
          { sql: "DELETE FROM test_submissions", args: [] },
        ]);
        break;
      case "delete_real_ballots": {
        if (payload.confirmation !== "DELETE REAL BALLOTS") {
          return Response.json(
            { error: "Type DELETE REAL BALLOTS to confirm." },
            { status: 400 },
          );
        }
        const countResult = await db.execute(
          "SELECT COUNT(*) AS count FROM submissions",
        );
        const count = Number(countResult.rows[0]?.count ?? 0);
        if (count > 0) {
          const batchId = crypto.randomUUID();
          await db.batch([
            {
              sql: "INSERT INTO archive_batches (id, archived_at, ballot_count) VALUES (?, ?, ?)",
              args: [batchId, now, count],
            },
            {
              sql: "INSERT INTO archived_submissions (batch_id, id, created_at) SELECT ?, id, created_at FROM submissions",
              args: [batchId],
            },
            {
              sql: "INSERT INTO archived_votes (batch_id, submission_id, question_id, nominee, created_at) SELECT ?, submission_id, question_id, nominee, created_at FROM votes",
              args: [batchId],
            },
            { sql: "DELETE FROM votes", args: [] },
            { sql: "DELETE FROM submissions", args: [] },
          ]);
        }
        break;
      }
      case "restore_real_ballots": {
        const batchResult = await db.execute(
          "SELECT id FROM archive_batches ORDER BY archived_at DESC LIMIT 1",
        );
        const batchId = String(batchResult.rows[0]?.id ?? "");
        if (batchId) {
          await db.batch([
            {
              sql: "INSERT OR IGNORE INTO submissions (id, created_at) SELECT id, created_at FROM archived_submissions WHERE batch_id = ?",
              args: [batchId],
            },
            {
              sql: "INSERT OR IGNORE INTO votes (submission_id, question_id, nominee, created_at) SELECT submission_id, question_id, nominee, created_at FROM archived_votes WHERE batch_id = ?",
              args: [batchId],
            },
            {
              sql: "DELETE FROM archived_votes WHERE batch_id = ?",
              args: [batchId],
            },
            {
              sql: "DELETE FROM archived_submissions WHERE batch_id = ?",
              args: [batchId],
            },
            {
              sql: "DELETE FROM archive_batches WHERE id = ?",
              args: [batchId],
            },
          ]);
        }
        break;
      }
      default:
        return Response.json({ error: "Unknown host action." }, { status: 400 });
    }

    return Response.json(await getHostState(), {
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "The host action could not be completed." },
      { status: 500 },
    );
  }
}
