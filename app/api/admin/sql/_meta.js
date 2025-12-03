import db from "@/lib/db";

// Optional friendly labels for known tables/columns
const TABLE_LABELS = {
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
  r1_topic: {
    label: "Round 1 Topics",
    columnLabels: { id: "ID", name: "Topic Name" },
  },
  r1_questions: {
    label: "Round 1 Questions",
    columnLabels: {
      id: "Question ID",
      topic: "Topic (text)",
      text: "Question Text",
      topic_id: "Topic ID (FK)",
    },
  },
  r1_options: {
    label: "Round 1 Options",
    columnLabels: {
      id: "Option ID",
      question_id: "Question ID",
      opt: "Option",
    },
  },
  r2_topic: {
    label: "Round 2 Topics",
    columnLabels: { id: "ID", name: "Topic Name" },
  },
  r2_questions: {
    label: "Round 2 Questions",
    columnLabels: {
      id: "Question ID",
      topic: "Topic (text)",
      text: "Question Text",
      topic_id: "Topic ID (FK)",
      correct: "Correct Answer",
    },
  },
};

function assertSafeTableName(table) {
  return /^[A-Za-z0-9_]+$/.test(table);
}

export function listAllTables() {
  return db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    .all()
    .map((row) => row.name);
}

export function assertAllowed(table) {
  if (!table || !assertSafeTableName(table))
    throw new Error("Table not allowed");
  const exists = db
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1"
    )
    .get(table);
  if (!exists) throw new Error("Table not allowed");
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
  const meta = TABLE_LABELS[table] || {};
  return {
    name: table,
    label: meta.label || table,
    columns: cols.map((c) => ({
      name: c.name,
      type: c.type,
      notnull: !!c.notnull,
      dflt: c.dflt_value ?? null,
      pk: !!c.pk,
      label: meta.columnLabels?.[c.name] || c.name,
    })),
    pk,
    autoincrement,
  };
}

export function getTableSummary() {
  return listAllTables().map((name) => ({
    name,
    label: TABLE_LABELS[name]?.label || name,
  }));
}
