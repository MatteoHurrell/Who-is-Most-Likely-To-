import { createClient } from "@libsql/client";

export function getDatabase() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error("The survey database is unavailable.");
  }

  return createClient({ url, authToken });
}

export async function ensureSurveySchema(
  db: ReturnType<typeof createClient>,
) {
  await db.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY NOT NULL,
        created_at INTEGER NOT NULL
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS votes (
        submission_id TEXT NOT NULL,
        question_id INTEGER NOT NULL,
        nominee TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (submission_id, question_id),
        FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
      )`,
      args: [],
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS votes_question_nominee_idx
        ON votes (question_id, nominee)`,
      args: [],
    },
  ]);
}
