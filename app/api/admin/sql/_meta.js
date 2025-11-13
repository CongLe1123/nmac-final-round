import db from "@/lib/db";

export const TABLES = {
  users: {
    label: "Users",
    columnLabels: {
      id: "ID",
      username: "Username",
      password: "Password",
      role: "Role",
    },
  },
  settings: {
    label: "Settings",
    columnLabels: { key: "Setting Key", value: "Value (JSON)" },
  },
  team_state: {
    label: "Team State",
    columnLabels: {
      username: "Team Username",
      score: "Score",
      hermes_used: "Hermes Used (0/1)",
    },
  },
  r1_questions: {
    label: "Round 1 Questions",
    columnLabels: { id: "Question ID", topic: "Topic", text: "Question Text" },
  },
  r2_questions: {
    label: "Round 2 Questions",
    columnLabels: { id: "Question ID", topic: "Topic", text: "Question Text" },
  },
  r2_options: {
    label: "Round 2 Options",
    columnLabels: {
      id: "Option ID",
      question_id: "Question ID",
      opt: "Option",
    },
  },
};

export function assertAllowed(table) {
  if (!TABLES[table]) {
    throw new Error("Table not allowed");
  }
}

export function getTableInfo(table) {
  assertAllowed(table);
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  const row = db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1"
    )
    .get(table);
  const createSql = row?.sql || "";
  const pkCols = cols.filter((c) => c.pk).map((c) => c.name);
  const pk = pkCols.length === 1 ? pkCols[0] : null;
  const autoincrement =
    /AUTOINCREMENT/i.test(createSql) && /PRIMARY KEY/i.test(createSql);
  return {
    name: table,
    label: TABLES[table].label,
    columns: cols.map((c) => ({
      name: c.name,
      type: c.type,
      notnull: !!c.notnull,
      dflt: c.dflt_value ?? null,
      pk: !!c.pk,
      label: TABLES[table].columnLabels?.[c.name] || c.name,
    })),
    pk,
    autoincrement,
  };
}
