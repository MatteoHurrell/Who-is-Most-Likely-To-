import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const submissions = sqliteTable("submissions", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at").notNull(),
});

export const votes = sqliteTable(
  "votes",
  {
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    questionId: integer("question_id").notNull(),
    nominee: text("nominee").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.submissionId, table.questionId] }),
    index("votes_question_nominee_idx").on(table.questionId, table.nominee),
  ],
);
