import db from "./db";

// Database-backed question bank for Round One
// Expose the same API surface as before for compatibility

function loadAllQuestions() {
  try {
    const rows = db
      .prepare("SELECT id, topic, text FROM r1_questions ORDER BY id")
      .all();
    return rows || [];
  } catch {
    return [];
  }
}

export const QUESTIONS = loadAllQuestions();

export function getQuestionById(id) {
  try {
    const row = db
      .prepare("SELECT id, topic, text FROM r1_questions WHERE id = ?")
      .get(id);
    return row || null;
  } catch {
    return null;
  }
}
