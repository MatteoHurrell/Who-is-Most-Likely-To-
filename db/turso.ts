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
    {
      sql: `CREATE TABLE IF NOT EXISTS test_submissions (
        id TEXT PRIMARY KEY NOT NULL,
        created_at INTEGER NOT NULL
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS test_votes (
        submission_id TEXT NOT NULL,
        question_id INTEGER NOT NULL,
        nominee TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (submission_id, question_id),
        FOREIGN KEY (submission_id) REFERENCES test_submissions(id) ON DELETE CASCADE
      )`,
      args: [],
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS test_votes_question_nominee_idx
        ON test_votes (question_id, nominee)`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS site_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        voting_open INTEGER NOT NULL DEFAULT 1,
        results_public INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      )`,
      args: [],
    },
    {
      sql: `INSERT OR IGNORE INTO site_state
        (id, voting_open, results_public, updated_at)
        VALUES (1, 1, 0, ?)`,
      args: [Date.now()],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS archive_batches (
        id TEXT PRIMARY KEY NOT NULL,
        archived_at INTEGER NOT NULL,
        ballot_count INTEGER NOT NULL
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS archived_submissions (
        batch_id TEXT NOT NULL,
        id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (batch_id, id),
        FOREIGN KEY (batch_id) REFERENCES archive_batches(id) ON DELETE CASCADE
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS archived_votes (
        batch_id TEXT NOT NULL,
        submission_id TEXT NOT NULL,
        question_id INTEGER NOT NULL,
        nominee TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (batch_id, submission_id, question_id),
        FOREIGN KEY (batch_id) REFERENCES archive_batches(id) ON DELETE CASCADE
      )`,
      args: [],
    },
  ]);
}
