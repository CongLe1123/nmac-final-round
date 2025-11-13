import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

const PLACEHOLDERS = [
  // Nội khoa
  { id: "noi-1", topic: "Nội khoa", text: "Câu hỏi 1 - Nội khoa" },
  { id: "noi-2", topic: "Nội khoa", text: "Câu hỏi 2 - Nội khoa" },
  { id: "noi-3", topic: "Nội khoa", text: "Câu hỏi 3 - Nội khoa" },
  // Ngoại khoa
  { id: "ngoai-1", topic: "Ngoại khoa", text: "Câu hỏi 1 - Ngoại khoa" },
  { id: "ngoai-2", topic: "Ngoại khoa", text: "Câu hỏi 2 - Ngoại khoa" },
  { id: "ngoai-3", topic: "Ngoại khoa", text: "Câu hỏi 3 - Ngoại khoa" },
  // Sản–Nhi
  { id: "sannhi-1", topic: "Sản–Nhi", text: "Câu hỏi 1 - Sản–Nhi" },
  { id: "sannhi-2", topic: "Sản–Nhi", text: "Câu hỏi 2 - Sản–Nhi" },
  { id: "sannhi-3", topic: "Sản–Nhi", text: "Câu hỏi 3 - Sản–Nhi" },
  // Tâm thần–Thần kinh
  {
    id: "tamthan-1",
    topic: "Tâm thần–Thần kinh",
    text: "Câu hỏi 1 - Tâm thần–Thần kinh",
  },
  {
    id: "tamthan-2",
    topic: "Tâm thần–Thần kinh",
    text: "Câu hỏi 2 - Tâm thần–Thần kinh",
  },
  {
    id: "tamthan-3",
    topic: "Tâm thần–Thần kinh",
    text: "Câu hỏi 3 - Tâm thần–Thần kinh",
  },
];

export async function POST() {
  try {
    // Ensure table exists
    db.exec(
      "CREATE TABLE IF NOT EXISTS r1_questions (id TEXT PRIMARY KEY, topic TEXT NOT NULL, text TEXT NOT NULL)"
    );

    const cnt = db.prepare("SELECT COUNT(*) AS c FROM r1_questions").get();
    if (cnt?.c) {
      return NextResponse.json({
        ok: true,
        seeded: false,
        message: "r1_questions not empty",
      });
    }

    const insert = db.prepare(
      "INSERT OR IGNORE INTO r1_questions (id, topic, text) VALUES (?, ?, ?)"
    );
    const txn = db.transaction((rows) => {
      for (const r of rows) insert.run(r.id, r.topic, r.text);
    });
    txn(PLACEHOLDERS);

    const after = db.prepare("SELECT COUNT(*) AS c FROM r1_questions").get();
    return NextResponse.json({ ok: true, seeded: true, count: after?.c || 0 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to seed r1 questions" },
      { status: 500 }
    );
  }
}
