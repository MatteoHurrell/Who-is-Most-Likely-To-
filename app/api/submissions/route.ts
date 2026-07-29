import { ensureSurveySchema, getDatabase } from "../../../db/turso";
import { nominees, questions } from "../../../data/survey";
import { isHostAuthenticated } from "../../../lib/host-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      answers?: unknown;
      mode?: "real" | "test";
    };
    if (
      !Array.isArray(payload.answers) ||
      payload.answers.length !== questions.length
    ) {
      return Response.json(
        { error: "Every question must be answered." },
        { status: 400 },
      );
    }

    const nomineeSet = new Set<string>(nominees);
    const answers = payload.answers as unknown[];
    if (
      answers.some(
        (answer) => typeof answer !== "string" || !nomineeSet.has(answer),
      )
    ) {
      return Response.json(
        { error: "One or more answers are invalid." },
        { status: 400 },
      );
    }

    const db = getDatabase();
    await ensureSurveySchema(db);
    const isTest = payload.mode === "test";

    if (isTest && !(await isHostAuthenticated())) {
      return Response.json(
        { error: "Host access is required for test ballots." },
        { status: 401 },
      );
    }

    if (!isTest) {
      const stateResult = await db.execute(
        "SELECT voting_open FROM site_state WHERE id = 1",
      );
      if (!Boolean(stateResult.rows[0]?.voting_open)) {
        return Response.json(
          { error: "Voting is closed." },
          { status: 423 },
        );
      }
    }

    const submissionId = crypto.randomUUID();
    const createdAt = Date.now();
    const submissionsTable = isTest ? "test_submissions" : "submissions";
    const votesTable = isTest ? "test_votes" : "votes";
    await db.batch([
      {
        sql: `INSERT INTO ${submissionsTable} (id, created_at) VALUES (?, ?)`,
        args: [submissionId, createdAt],
      },
      ...answers.map((answer, index) => ({
        sql: `INSERT INTO ${votesTable} (submission_id, question_id, nominee, created_at) VALUES (?, ?, ?, ?)`,
        args: [submissionId, index + 1, answer as string, createdAt],
      })),
    ]);

    return Response.json({ ok: true, mode: isTest ? "test" : "real" }, { status: 201 });
  } catch {
    return Response.json(
      { error: "The ballot could not be saved." },
      { status: 500 },
    );
  }
}
