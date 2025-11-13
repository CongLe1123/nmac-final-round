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

// Initialize schema
db.exec(
  "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL)"
);

// Settings table for global flags (e.g., current round)
db.exec(
  "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
);

// Round Two: questions and options stored in DB
db.exec(
  "CREATE TABLE IF NOT EXISTS r2_questions (id TEXT PRIMARY KEY, topic TEXT NOT NULL, text TEXT NOT NULL)"
);
db.exec(
  "CREATE TABLE IF NOT EXISTS r2_options (id INTEGER PRIMARY KEY AUTOINCREMENT, question_id TEXT NOT NULL, opt TEXT NOT NULL, FOREIGN KEY(question_id) REFERENCES r2_questions(id))"
);

// Round One: questions stored in DB
db.exec(
  "CREATE TABLE IF NOT EXISTS r1_questions (id TEXT PRIMARY KEY, topic TEXT NOT NULL, text TEXT NOT NULL)"
);

// Seed placeholder Round 2 questions/options if empty
try {
  const cnt = db.prepare("SELECT COUNT(*) AS c FROM r2_questions").get();
  if (!cnt?.c) {
    const topics = ["Nội khoa", "Ngoại khoa", "Sản–Nhi", "Tâm thần–Thần kinh"];
    const qInsert = db.prepare(
      "INSERT OR IGNORE INTO r2_questions (id, topic, text) VALUES (?, ?, ?)"
    );
    const oInsert = db.prepare(
      "INSERT INTO r2_options (question_id, opt) VALUES (?, ?)"
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
          qInsert.run(id, t, `Câu hỏi R2 - ${t} ${i}`);
          ["A", "B", "C", "D"].forEach((opt) => oInsert.run(id, opt));
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
    const seedTxn = db.transaction(() => {
      for (const t of topics) {
        for (let i = 1; i <= 3; i++) {
          const id = `${t.key}-${i}`;
          insertR1.run(id, t.label, `Câu hỏi ${i} - ${t.label}`);
        }
      }
    });
    seedTxn();
  }
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

export default db;
