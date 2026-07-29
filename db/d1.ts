import { env } from "cloudflare:workers";

export function getD1() {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) {
    throw new Error("The survey database is unavailable.");
  }
  return db;
}

export async function ensureSurveySchema(db: D1Database) {
  await db.batch([
    db
      .prepare(
        `CREATE TABLE IF NOT EXISTS submissions (
          id TEXT PRIMARY KEY NOT NULL,
          created_at INTEGER NOT NULL
        )`,
      ),
    db
      .prepare(
        `CREATE TABLE IF NOT EXISTS votes (
          submission_id TEXT NOT NULL,
          question_id INTEGER NOT NULL,
          nominee TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          PRIMARY KEY (submission_id, question_id),
          FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
        )`,
      ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS votes_question_nominee_idx ON votes (question_id, nominee)",
    ),
  ]);
}
