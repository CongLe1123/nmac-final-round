import db from "./db";

// Database-backed question bank for Round One
// Expose the same API surface as before for compatibility

function loadAllQuestions() {
  try {
    const rows = db
      .prepare(
        "SELECT q.id as id, COALESCE(q.topic, t.name) as topic, q.text as text FROM r1_questions q LEFT JOIN r1_topic t ON q.topic_id = t.id ORDER BY q.id"
      )
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
      .prepare(
        "SELECT q.id as id, COALESCE(q.topic, t.name) as topic, q.text as text FROM r1_questions q LEFT JOIN r1_topic t ON q.topic_id = t.id WHERE q.id = ?"
      )
      .get(id);
    return row || null;
  } catch {
    return null;
  }
}
