import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const editions = sqliteTable("editions", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  slot: text("slot").notNull(),
  generatedAt: text("generated_at").notNull(),
  payload: text("payload").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const sourceReports = sqliteTable("source_reports", {
  id: text("id").primaryKey(),
  checkedAt: text("checked_at").notNull(),
  status: text("status").notNull(),
  payload: text("payload").notNull(),
});
