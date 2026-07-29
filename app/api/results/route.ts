import { env } from "cloudflare:workers";
import { ensureSurveySchema, getD1 } from "../../../db/d1";
import { questions } from "../../../data/survey";

export const dynamic = "force-dynamic";

type VoteCount = {
  question_id: number;
  nominee: string;
  votes: number;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { pin?: unknown };
    const resultsPin = (env as unknown as { RESULTS_PIN?: string }).RESULTS_PIN;

    if (
      typeof payload.pin !== "string" ||
      !resultsPin ||
      payload.pin !== resultsPin
    ) {
      return Response.json(
        { error: "The PIN is incorrect." },
        {
          status: 401,
          headers: { "cache-control": "no-store" },
        },
      );
    }

    const db = getD1();
    await ensureSurveySchema(db);
    const query = await db
      .prepare(
        `SELECT question_id, nominee, COUNT(*) AS votes
         FROM votes
         GROUP BY question_id, nominee
         ORDER BY question_id ASC, votes DESC, nominee ASC`,
      )
      .all<VoteCount>();

    const rows = query.results ?? [];
    const results = questions.map((_, questionIndex) => {
      const questionId = questionIndex + 1;
      const questionRows = rows.filter(
        (row) => Number(row.question_id) === questionId,
      );
      const totalVotes = questionRows.reduce(
        (sum, row) => sum + Number(row.votes),
        0,
      );
      const maxVotes = questionRows.length
        ? Math.max(...questionRows.map((row) => Number(row.votes)))
        : 0;

      return {
        questionId,
        totalVotes,
        winnerNames: questionRows
          .filter((row) => Number(row.votes) === maxVotes && maxVotes > 0)
          .map((row) => row.nominee),
        nominees: questionRows.map((row) => ({
          name: row.nominee,
          votes: Number(row.votes),
          percentage:
            totalVotes === 0 ? 0 : (Number(row.votes) / totalVotes) * 100,
        })),
      };
    });

    return Response.json(
      { results },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Results are unavailable." },
      {
        status: 500,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}
