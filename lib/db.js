import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Resolve database file inside the repository
const dbPath = path.join(process.cwd(), "lib", "login-data.sqlite");

// Ensure directory exists (lib/)
try {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
} catch {}

// Open/create database
const db = new Database(dbPath);

// Ensure foreign keys are enforced
try {
  db.exec("PRAGMA foreign_keys = ON");
} catch {}

// Initialize schema
db.exec(
  "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL)"
);

// Settings table for global flags (e.g., current round)
db.exec(
  "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
);

// Round Two: questions stored in DB
db.exec(
  "CREATE TABLE IF NOT EXISTS r2_questions (id TEXT PRIMARY KEY, topic TEXT NOT NULL, text TEXT NOT NULL)"
);

// Add missing columns for Round 2 questions
try {
  const cols = db.prepare("PRAGMA table_info(r2_questions)").all();
  if (!cols.find((c) => c.name === "correct")) {
    db.exec("ALTER TABLE r2_questions ADD COLUMN correct TEXT");
  }
} catch {}

// Round One: questions stored in DB
db.exec(
  "CREATE TABLE IF NOT EXISTS r1_questions (id TEXT PRIMARY KEY, topic TEXT NOT NULL, text TEXT NOT NULL)"
);

// Round One: multiple-choice options stored in DB
db.exec(
  "CREATE TABLE IF NOT EXISTS r1_options (id INTEGER PRIMARY KEY AUTOINCREMENT, question_id TEXT NOT NULL, opt TEXT NOT NULL, FOREIGN KEY(question_id) REFERENCES r1_questions(id))"
);

// Remove deprecated Round 2 options table if it still exists
try {
  db.exec("DROP TABLE IF EXISTS r2_options");
} catch {}

// Topics tables (dynamic topics for each round)
db.exec(
  "CREATE TABLE IF NOT EXISTS r1_topic (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL)"
);
db.exec(
  "CREATE TABLE IF NOT EXISTS r2_topic (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL)"
);

// Add nullable topic_id columns if not exist (for relationships)
try {
  const cols = db.prepare("PRAGMA table_info(r1_questions)").all();
  if (!cols.find((c) => c.name === "topic_id")) {
    db.exec("ALTER TABLE r1_questions ADD COLUMN topic_id INTEGER");
  }
} catch {}
try {
  const cols = db.prepare("PRAGMA table_info(r2_questions)").all();
  if (!cols.find((c) => c.name === "topic_id")) {
    db.exec("ALTER TABLE r2_questions ADD COLUMN topic_id INTEGER");
  }
} catch {}

// Seed topics if empty
try {
  const r1tc = db.prepare("SELECT COUNT(*) AS c FROM r1_topic").get();
  if (!r1tc?.c) {
    const topics = ["Nội khoa", "Ngoại khoa", "Sản–Nhi", "Tâm thần–Thần kinh"];
    const ins = db.prepare("INSERT OR IGNORE INTO r1_topic (name) VALUES (?)");
    const txn = db.transaction(() => topics.forEach((t) => ins.run(t)));
    txn();
  }
} catch {}
try {
  const r2tc = db.prepare("SELECT COUNT(*) AS c FROM r2_topic").get();
  if (!r2tc?.c) {
    const topics = ["Nội khoa", "Ngoại khoa", "Sản–Nhi", "Tâm thần–Thần kinh"];
    const ins = db.prepare("INSERT OR IGNORE INTO r2_topic (name) VALUES (?)");
    const txn = db.transaction(() => topics.forEach((t) => ins.run(t)));
    txn();
  }
} catch {}

// Seed placeholder Round 2 questions if empty
try {
  const cnt = db.prepare("SELECT COUNT(*) AS c FROM r2_questions").get();
  if (!cnt?.c) {
    const topics = ["Nội khoa", "Ngoại khoa", "Sản–Nhi", "Tâm thần–Thần kinh"];
    const qInsert = db.prepare(
      "INSERT OR IGNORE INTO r2_questions (id, topic, text, correct) VALUES (?, ?, ?, ?)"
    );
    const seedTxn = db.transaction(() => {
      for (const t of topics) {
        for (let i = 1; i <= 2; i++) {
          const slug =
            t === "Nội khoa"
              ? "noi"
              : t === "Ngoại khoa"
              ? "ngoai"
              : t === "Sản–Nhi"
              ? "sannhi"
              : "tamthan";
          const id = `r2-${slug}-${i}`;
          qInsert.run(
            id,
            t,
            `Câu hỏi R2 - ${t} ${i}`,
            `Đáp án mẫu cho ${t} ${i}`
          );
        }
      }
    });
    seedTxn();
  }
} catch {}

// Seed Round 1 questions if empty
try {
  const cntR1 = db.prepare("SELECT COUNT(*) AS c FROM r1_questions").get();
  if (!cntR1?.c) {
    const insertR1 = db.prepare(
      "INSERT OR IGNORE INTO r1_questions (id, topic, text) VALUES (?, ?, ?)"
    );
    const topics = [
      { key: "noi", label: "Nội khoa" },
      { key: "ngoai", label: "Ngoại khoa" },
      { key: "sannhi", label: "Sản–Nhi" },
      { key: "tamthan", label: "Tâm thần–Thần kinh" },
    ];
    const optInsert = db.prepare(
      "INSERT OR IGNORE INTO r1_options (question_id, opt) VALUES (?, ?)"
    );
    const seedTxn = db.transaction(() => {
      for (const t of topics) {
        for (let i = 1; i <= 3; i++) {
          const id = `${t.key}-${i}`;
          insertR1.run(id, t.label, `Câu hỏi ${i} - ${t.label}`);
          const labels = ["A", "B", "C", "D"];
          for (const label of labels) {
            optInsert.run(id, `Option ${label}`);
          }
        }
      }
    });
    seedTxn();
  }
} catch {}

// Seed placeholder Round 1 options if table remains empty (e.g., existing questions inserted earlier)
try {
  const optCount = db.prepare("SELECT COUNT(*) AS c FROM r1_options").get();
  if (!optCount?.c) {
    const qIds = db.prepare("SELECT id FROM r1_questions ORDER BY id").all();
    const insertOpt = db.prepare(
      "INSERT INTO r1_options (question_id, opt) VALUES (?, ?)"
    );
    const txn = db.transaction(() => {
      for (const row of qIds || []) {
        ["Option A", "Option B", "Option C", "Option D"].forEach((opt) =>
          insertOpt.run(row.id, opt)
        );
      }
    });
    txn();
  }
} catch {}

// Backfill topic_id for r1_questions and r2_questions if possible
try {
  const r1Rows = db
    .prepare(
      "SELECT id, topic FROM r1_questions WHERE topic_id IS NULL OR topic_id = ''"
    )
    .all();
  const findTopic = db.prepare("SELECT id FROM r1_topic WHERE name = ?");
  const upd = db.prepare("UPDATE r1_questions SET topic_id = ? WHERE id = ?");
  const txn = db.transaction(() => {
    for (const r of r1Rows || []) {
      const t = findTopic.get(r.topic);
      if (t?.id) upd.run(t.id, r.id);
    }
  });
  txn();
} catch {}
try {
  const r2Rows = db
    .prepare(
      "SELECT id, topic FROM r2_questions WHERE topic_id IS NULL OR topic_id = ''"
    )
    .all();
  const findTopic = db.prepare("SELECT id FROM r2_topic WHERE name = ?");
  const upd = db.prepare("UPDATE r2_questions SET topic_id = ? WHERE id = ?");
  const txn = db.transaction(() => {
    for (const r of r2Rows || []) {
      const t = findTopic.get(r.topic);
      if (t?.id) upd.run(t.id, r.id);
    }
  });
  txn();
} catch {}

// Seed data if empty. Prefer migrating from existing JSON if present
const countRow = db.prepare("SELECT COUNT(*) AS cnt FROM users").get();
if (!countRow?.cnt) {
  let seedUsers = [
    { username: "admin", password: "123456789Aa", role: "admin" },
    { username: "team1", password: "123456789Aa", role: "team" },
    { username: "team2", password: "123456789Aa", role: "team" },
    { username: "team3", password: "123456789Aa", role: "team" },
    { username: "team4", password: "123456789Aa", role: "team" },
  ];

  const jsonPath = path.join(process.cwd(), "lib", "login-data.json");
  try {
    if (fs.existsSync(jsonPath)) {
      const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      if (parsed && Array.isArray(parsed.users) && parsed.users.length) {
        seedUsers = parsed.users.map((u) => ({
          username: u.username,
          password: u.password,
          role: u.role || (u.username === "admin" ? "admin" : "team"),
        }));
      }
    }
  } catch {}

  const insert = db.prepare(
    "INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)"
  );
  const txn = db.transaction((rows) => {
    for (const u of rows) insert.run(u.username, u.password, u.role);
  });
  txn(seedUsers);
}

// Seed default current round if not present
const getSetting = db.prepare("SELECT value FROM settings WHERE key = ?");
const setSetting = db.prepare(
  "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
);

const currentRound = getSetting.get("current_round");
if (!currentRound) {
  setSetting.run("current_round", "pre-round-one");
}

// Migrate team_state to use user_id FK primary key instead of username text
try {
  const cols = db.prepare("PRAGMA table_info(team_state)").all();
  const hasUserId = cols.some(
    (c) => String(c.name).toLowerCase() === "user_id"
  );
  if (!hasUserId) {
    db.exec(
      "CREATE TABLE IF NOT EXISTS team_state_new (user_id INTEGER PRIMARY KEY, score INTEGER NOT NULL DEFAULT 0, hermes_used INTEGER NOT NULL DEFAULT 0, FOREIGN KEY(user_id) REFERENCES users(id))"
    );
    const rows = db
      .prepare("SELECT username, score, hermes_used FROM team_state")
      .all();
    const findUser = db.prepare("SELECT id FROM users WHERE username = ?");
    const ins = db.prepare(
      "INSERT OR IGNORE INTO team_state_new (user_id, score, hermes_used) VALUES (?, ?, ?)"
    );
    const txn = db.transaction(() => {
      for (const r of rows || []) {
        const u = findUser.get(r.username);
        if (u?.id) ins.run(u.id, r.score || 0, r.hermes_used || 0);
      }
    });
    txn();
    db.exec("DROP TABLE IF EXISTS team_state");
    db.exec("ALTER TABLE team_state_new RENAME TO team_state");
  }
} catch {}

// Triggers: auto-fill topic_id from topic text if not provided
try {
  db.exec(`CREATE TRIGGER IF NOT EXISTS trg_r1q_set_topic_id_after_insert
AFTER INSERT ON r1_questions
FOR EACH ROW
WHEN NEW.topic_id IS NULL OR NEW.topic_id = ''
BEGIN
  UPDATE r1_questions
  SET topic_id = (SELECT id FROM r1_topic WHERE name = NEW.topic)
  WHERE id = NEW.id;
END;`);
} catch {}
try {
  db.exec(`CREATE TRIGGER IF NOT EXISTS trg_r2q_set_topic_id_after_insert
AFTER INSERT ON r2_questions
FOR EACH ROW
WHEN NEW.topic_id IS NULL OR NEW.topic_id = ''
BEGIN
  UPDATE r2_questions
  SET topic_id = (SELECT id FROM r2_topic WHERE name = NEW.topic)
  WHERE id = NEW.id;
END;`);
} catch {}

export default db;
