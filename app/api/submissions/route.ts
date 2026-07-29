import { ensureSurveySchema, getD1 } from "../../../db/d1";
import { nominees, questions } from "../../../data/survey";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { answers?: unknown };
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

    const db = getD1();
    await ensureSurveySchema(db);

    const submissionId = crypto.randomUUID();
    const createdAt = Date.now();
    await db.batch([
      db
        .prepare("INSERT INTO submissions (id, created_at) VALUES (?, ?)")
        .bind(submissionId, createdAt),
      ...answers.map((answer, index) =>
        db
          .prepare(
            "INSERT INTO votes (submission_id, question_id, nominee, created_at) VALUES (?, ?, ?, ?)",
          )
          .bind(submissionId, index + 1, answer, createdAt),
      ),
    ]);

    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return Response.json(
      { error: "The ballot could not be saved." },
      { status: 500 },
    );
  }
}
