import type { Client } from "@libsql/client";
import { questions } from "../data/survey";

type Dataset = "real" | "test";

type VoteCount = {
  question_id: number;
  nominee: string;
  votes: number;
};

export async function getResults(db: Client, dataset: Dataset) {
  const votesTable = dataset === "test" ? "test_votes" : "votes";
  const query = await db.execute({
    sql: `SELECT question_id, nominee, COUNT(*) AS votes
      FROM ${votesTable}
      GROUP BY question_id, nominee
      ORDER BY question_id ASC, votes DESC, nominee ASC`,
    args: [],
  });

  const rows = query.rows as unknown as VoteCount[];
  return questions.map((_, questionIndex) => {
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
}
