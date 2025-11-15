import db from "./db";
import { broadcast, makeEvent } from "./events";
import { getQuestionById, QUESTIONS } from "./questions";

// Topic helpers return id+name lists only

export function getR1TopicList() {
  try {
    return db.prepare("SELECT id, name FROM r1_topic ORDER BY id").all() || [];
  } catch {
    return [];
  }
}

export function getR2TopicList() {
  try {
    return db.prepare("SELECT id, name FROM r2_topic ORDER BY id").all() || [];
  } catch {
    return [];
  }
}

// Ensure team_state table exists for scores and hermes usage (FK to users)
db.exec(
  "CREATE TABLE IF NOT EXISTS team_state (user_id INTEGER PRIMARY KEY, score INTEGER NOT NULL DEFAULT 0, hermes_used INTEGER NOT NULL DEFAULT 0, FOREIGN KEY(user_id) REFERENCES users(id))"
);

// Helper: list team users
export function getTeams() {
  const rows = db
    .prepare(
      "SELECT u.id as id, u.username as username, ts.score as score, ts.hermes_used as hermes_used FROM users u LEFT JOIN team_state ts ON ts.user_id = u.id WHERE u.role = 'team' ORDER BY u.id"
    )
    .all();
  return (rows || []).map((r) => ({
    id: r.id,
    username: r.username,
    score: r.score ?? 0,
    hermes_used: !!r.hermes_used,
  }));
}

// Ensure team_state rows exist for all teams
export function ensureTeamStateRows() {
  const teams = db.prepare("SELECT id FROM users WHERE role = 'team'").all();
  const insert = db.prepare(
    "INSERT OR IGNORE INTO team_state (user_id, score, hermes_used) VALUES (?, 0, 0)"
  );
  const txn = db.transaction((rows) => {
    for (const r of rows) insert.run(r.id);
  });
  txn(teams || []);
}

ensureTeamStateRows();

// Settings helpers
const getSettingStmt = db.prepare("SELECT value FROM settings WHERE key = ?");
const setSettingStmt = db.prepare(
  "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
);

function getJSON(key, def) {
  try {
    const row = getSettingStmt.get(key);
    if (!row?.value) return def;
    return JSON.parse(row.value);
  } catch {
    return def;
  }
}

function setJSON(key, value) {
  setSettingStmt.run(key, JSON.stringify(value));
}

// Game state stored in settings under key 'game_state'
const defaultGameState = () => ({
  roundOne: {
    eligibleSelectors: [], // userIds that can be selected to choose topic
    currentSelector: null, // userId currently selecting topic
    selectedTopics: {}, // { userId: topicId }
    questionVisible: false,
    currentQuestionId: null,
    currentQuestionTopicId: null,
    currentTopicSelectedBy: null, // userId
  },
  roundTwo: {
    topicId: null,
    maxBet: 0,
    currentQuestionId: null,
    currentQuestionText: null,
    questionVisible: false,
    optionsVisible: false,
    options: [],
    bets: {}, // { userId: number }
    answers: {}, // { userId: string }
    correctAnswer: null,
    stage: "idle", // idle | topic | question | options | revealed
  },
  buzz: {
    allowed: false,
    winner: null, // userId
    winners: [], // userIds
  },
  hermes: {
    lastUsedById: null, // userId of the most recent use (for visible cue)
  },
});

export function getGameState() {
  const st = getJSON("game_state", null);
  if (!st) return defaultGameState();
  // Defensive fill of missing keys
  return {
    roundOne: {
      selectedTopics: {},
      eligibleSelectors: [],
      questionVisible: false,
      currentSelector: null,
      currentQuestionId: null,
      currentQuestionTopicId: null,
      currentTopicSelectedBy: null,
      ...(st.roundOne || {}),
    },
    roundTwo: {
      topicId: null,
      maxBet: 0,
      currentQuestionId: null,
      currentQuestionText: null,
      questionVisible: false,
      optionsVisible: false,
      options: [],
      bets: {},
      answers: {},
      correctAnswer: null,
      stage: "idle",
      ...(st.roundTwo || {}),
    },
    buzz: { allowed: false, winner: null, winners: [], ...(st.buzz || {}) },
    hermes: { lastUsedById: null, ...(st.hermes || {}) },
  };
}

function saveGameState(next) {
  setJSON("game_state", next);
  return next;
}

// =====================
// User / ID helpers
// =====================

export function getUserById(userId) {
  try {
    return db
      .prepare("SELECT id, username, role FROM users WHERE id = ?")
      .get(Number(userId));
  } catch {
    return null;
  }
}

export function getUsernameById(userId) {
  const u = getUserById(userId);
  return u?.username || null;
}

function coerceUsername({ userId, username }) {
  if (userId != null && userId !== "") {
    const name = getUsernameById(userId);
    if (name) return name;
  }
  return username || null;
}

// Score adjustments
export function adjustScore(username, delta) {
  if (!username || !Number.isFinite(delta)) return getTeams();
  const user = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(username);
  if (!user?.id) return getTeams();
  db.prepare("UPDATE team_state SET score = score + ? WHERE user_id = ?").run(
    delta,
    user.id
  );
  const teams = getTeams();
  broadcast(makeEvent("score:update", { teams }));
  return teams;
}

export function adjustScoreById(userId, delta) {
  const username = coerceUsername({ userId });
  return adjustScore(username, delta);
}

export function setEligibleSelectors(usernames) {
  const state = getGameState();
  // Treat input as userIds now
  const ids = Array.isArray(usernames) ? usernames.map((x) => Number(x)) : [];
  state.roundOne.eligibleSelectors = [
    ...new Set(ids.filter((x) => Number.isFinite(x))),
  ];
  saveGameState(state);
  broadcast(
    makeEvent("r1:eligibility", {
      eligibleSelectors: state.roundOne.eligibleSelectors,
    })
  );
  return state;
}

export function setCurrentSelector(username) {
  // Backward compatibility: resolve username to id
  const row = username
    ? db.prepare("SELECT id FROM users WHERE username = ?").get(username)
    : null;
  const id = row?.id || null;
  return setCurrentSelectorById(id);
}

export function setCurrentSelectorById(userId) {
  const state = getGameState();
  if (!userId) state.roundOne.currentSelector = null;
  else state.roundOne.currentSelector = Number(userId);
  saveGameState(state);
  broadcast(
    makeEvent("r1:selector", {
      currentSelector: state.roundOne.currentSelector,
    })
  );
  return state;
}

export function getAvailableTopicIds() {
  const state = getGameState();
  const chosenTopicIds = new Set(
    Object.values(state.roundOne.selectedTopics || {}).map((v) => Number(v))
  );
  const list = getR1TopicList();
  return list.filter((t) => !chosenTopicIds.has(t.id)).map((t) => t.id);
}

export function selectTopic(username, topic) {
  const state = getGameState();
  // Must be current selector and topic available
  const row = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(username);
  const uid = row?.id || null;
  if (!uid || state.roundOne.currentSelector !== uid) {
    return { ok: false, error: "Not allowed" };
  }
  // Allow both name or id; prefer id
  const list = getR1TopicList();
  const byName = list.find((t) => t.name === topic);
  if (!byName) {
    return { ok: false, error: "Invalid topic" };
  }
  const availableIds = getAvailableTopicIds();
  if (!availableIds.includes(byName.id)) {
    return { ok: false, error: "Topic already taken" };
  }
  state.roundOne.selectedTopics[uid] = byName.id;
  // Set active topic for question selection and clear any prior question
  state.roundOne.currentQuestionTopicId = byName.id;
  state.roundOne.currentTopicSelectedBy = uid;
  state.roundOne.currentQuestionId = null;
  // After picking, clear current selector
  state.roundOne.currentSelector = null;
  saveGameState(state);
  broadcast(
    makeEvent("r1:topic:selected", {
      userId: uid,
      topicId: byName.id,
      selectedTopics: state.roundOne.selectedTopics,
      availableTopicIds: getAvailableTopicIds(),
    })
  );
  return { ok: true, state };
}

export function selectTopicById(userId, topicId) {
  if (!Number.isFinite(topicId))
    return { ok: false, error: "Invalid topic id" };
  const id = Number(userId) || null;
  const state = getGameState();
  if (!id || state.roundOne.currentSelector !== id) {
    return { ok: false, error: "Not allowed" };
  }
  const list = getR1TopicList();
  const byId = list.find((t) => t.id === Number(topicId));
  if (!byId) return { ok: false, error: "Invalid topic id" };
  const availableIds = getAvailableTopicIds();
  if (!availableIds.includes(byId.id)) {
    return { ok: false, error: "Topic already taken" };
  }
  state.roundOne.selectedTopics[id] = byId.id;
  state.roundOne.currentQuestionId = null;
  state.roundOne.currentQuestionTopicId = byId.id;
  state.roundOne.currentTopicSelectedBy = id;
  state.roundOne.currentSelector = null;
  saveGameState(state);
  broadcast(
    makeEvent("r1:topic:selected", {
      userId: id,
      topicId: byId.id,
      selectedTopics: state.roundOne.selectedTopics,
      availableTopicIds: getAvailableTopicIds(),
    })
  );
  return { ok: true, state };
}

export function setQuestionVisible(visible) {
  const state = getGameState();
  state.roundOne.questionVisible = !!visible;
  saveGameState(state);
  broadcast(
    makeEvent("r1:question", { visible: state.roundOne.questionVisible })
  );
  return state;
}

export function setCurrentQuestion(id) {
  const q = id ? getQuestionById(id) : null;
  if (id && !q) {
    return { ok: false, error: "Invalid question id" };
  }
  const state = getGameState();
  if (id && state.roundOne.currentQuestionTopicId) {
    // Ensure topic matches selected topic id
    const qRow = db
      .prepare("SELECT topic_id FROM r1_questions WHERE id = ?")
      .get(id);
    const qTid = qRow?.topic_id || null;
    if (!qTid || qTid !== state.roundOne.currentQuestionTopicId) {
      return { ok: false, error: "Question does not match current topic" };
    }
  }
  state.roundOne.currentQuestionId = id || null;
  // Reset buzz state when question changes
  state.buzz.allowed = false;
  state.buzz.winner = null;
  state.buzz.winners = [];
  saveGameState(state);
  broadcast(
    makeEvent("r1:question:selected", {
      id: state.roundOne.currentQuestionId,
    })
  );
  // Inform clients buzz has been reset
  broadcast(
    makeEvent("buzz:allow", {
      allowed: state.buzz.allowed,
      winner: state.buzz.winner,
    })
  );
  return { ok: true, state };
}

export function listQuestions() {
  return QUESTIONS;
}

export function setBuzzAllowed(allowed) {
  const state = getGameState();
  state.buzz.allowed = !!allowed;
  if (allowed) state.buzz.winner = null; // reset winner on open
  saveGameState(state);
  broadcast(
    makeEvent("buzz:allow", {
      allowed: state.buzz.allowed,
      winner: state.buzz.winner,
    })
  );
  return state;
}

export function buzzIn(username) {
  // Backward compatibility: map username to id and delegate
  const row = username
    ? db.prepare("SELECT id FROM users WHERE username = ?").get(username)
    : null;
  const uid = row?.id || null;
  return buzzInById(uid);
}

export function buzzInById(userId) {
  const id = Number(userId) || null;
  const state = getGameState();
  if (!state.buzz.allowed || state.buzz.winner) {
    return { ok: false, error: "Buzz not allowed" };
  }
  if (id && state.roundOne.currentTopicSelectedBy === id) {
    return { ok: false, error: "Topic selector cannot buzz" };
  }
  // Disallow any previous winners for the current question
  const prev = new Set(state.buzz.winners || []);
  if (id && prev.has(id)) {
    return { ok: false, error: "Previous winner cannot buzz" };
  }
  state.buzz.winner = id;
  state.buzz.allowed = false; // lock after first buzz
  if (id) {
    prev.add(id);
    state.buzz.winners = Array.from(prev);
  }
  saveGameState(state);
  broadcast(makeEvent("buzz:winner", { winner: id, allowed: false }));
  return { ok: true, state };
}

export function useHermes(username) {
  if (!username) return { ok: false, error: "Missing username" };
  // ensure team_state exists
  ensureTeamStateRows();
  const row = db
    .prepare(
      "SELECT ts.hermes_used as hermes_used, u.id as id FROM team_state ts JOIN users u ON u.id = ts.user_id WHERE u.username = ?"
    )
    .get(username);
  if (!row) return { ok: false, error: "Unknown team" };
  if (row.hermes_used) return { ok: false, error: "Hermes already used" };
  db.prepare(
    "UPDATE team_state SET hermes_used = 1 WHERE user_id = (SELECT id FROM users WHERE username = ?)"
  ).run(username);
  const state = getGameState();
  state.hermes.lastUsedById = row.id || null;
  saveGameState(state);
  const teams = getTeams();
  broadcast(
    makeEvent("hermes:used", {
      userId: row.id || null,
      teams,
      lastUsedById: state.hermes.lastUsedById,
    })
  );
  return { ok: true, state, teams };
}

export function useHermesById(userId) {
  const username = coerceUsername({ userId });
  return useHermes(username);
}

export function clearHermesCue() {
  const state = getGameState();
  state.hermes.lastUsedById = null;
  saveGameState(state);
  broadcast(makeEvent("hermes:cleared", {}));
  return { ok: true, state };
}

// =======================
// Round Two helpers
// =======================

// Name-based Round 2 topic selection removed; use r2SetTopicById

export function r2SetTopicById(topicId) {
  if (!Number.isFinite(topicId) || topicId <= 0) {
    return { ok: false, error: "Invalid topic id" };
  }
  const row = db.prepare("SELECT name FROM r2_topic WHERE id = ?").get(topicId);
  if (!row?.name) return { ok: false, error: "Invalid topic id" };
  const topicName = row.name;
  const state = getGameState();
  state.roundTwo.topicId = topicId;
  state.roundTwo.maxBet = 0;
  state.roundTwo.currentQuestionId = null;
  state.roundTwo.currentQuestionText = null;
  state.roundTwo.questionVisible = false;
  state.roundTwo.optionsVisible = false;
  state.roundTwo.options = [];
  state.roundTwo.bets = {};
  state.roundTwo.answers = {};
  state.roundTwo.correctAnswer = null;
  state.roundTwo.stage = "topic";
  const list = r2ListQuestionsByTopicId(topicId);
  if (list.length > 0) {
    const q = list[0];
    state.roundTwo.currentQuestionId = q.id;
    state.roundTwo.currentQuestionText = q.text || null;
    state.roundTwo.options = r2ListOptions(q.id);
  }
  saveGameState(state);
  broadcast(makeEvent("r2:topic", { topicId }));
  if (state.roundTwo.currentQuestionId) {
    broadcast(
      makeEvent("r2:question:selected", {
        id: state.roundTwo.currentQuestionId,
      })
    );
  }
  return { ok: true, state };
}

export function r2SetMaxBet(maxBet) {
  const state = getGameState();
  const n = Math.max(0, Math.floor(Number(maxBet) || 0));
  state.roundTwo.maxBet = n;
  saveGameState(state);
  broadcast(makeEvent("r2:max-bet", { maxBet: n }));
  return { ok: true, state };
}

// Name-based R2 question listing removed; use r2ListQuestionsByTopicId

export function r2ListQuestionsByTopicId(topicId = null) {
  if (Number.isFinite(topicId) && topicId) {
    const rows = db
      .prepare(
        "SELECT q.id as id, COALESCE(q.topic, t.name) as topic, q.text as text FROM r2_questions q LEFT JOIN r2_topic t ON q.topic_id = t.id WHERE q.topic_id = ? ORDER BY q.id"
      )
      .all(topicId);
    return rows || [];
  }
  const rows = db
    .prepare(
      "SELECT q.id as id, COALESCE(q.topic, t.name) as topic, q.text as text FROM r2_questions q LEFT JOIN r2_topic t ON q.topic_id = t.id ORDER BY q.id"
    )
    .all();
  return rows || [];
}

export function r2ListOptions(questionId) {
  if (!questionId) return [];
  const stmt = db.prepare(
    "SELECT opt FROM r2_options WHERE question_id = ? ORDER BY id"
  );
  return (stmt.all(questionId) || []).map((r) => r.opt);
}

export function r2SelectQuestion(id) {
  // Accept either static R1 question or R2 DB question
  const r1q = id ? getQuestionById(id) : null;
  let topic = null;
  let topicId = null;
  let text = null;
  if (id && !r1q) {
    const row = db
      .prepare(
        "SELECT COALESCE(q.topic, t.name) as topic, q.text as text, q.topic_id as topicId FROM r2_questions q LEFT JOIN r2_topic t ON q.topic_id = t.id WHERE q.id = ?"
      )
      .get(id);
    if (!row) return { ok: false, error: "Invalid question id" };
    topic = row.topic;
    topicId = row.topicId || null;
    text = row.text || null;
  } else if (r1q) {
    topic = r1q.topic;
    text = r1q.text || null;
  }
  const state = getGameState();
  if (
    id &&
    state.roundTwo.topicId &&
    topicId &&
    state.roundTwo.topicId !== topicId
  ) {
    return { ok: false, error: "Question does not match current topic" };
  }
  state.roundTwo.currentQuestionId = id || null;
  state.roundTwo.currentQuestionText = text || null;
  // Preload options from DB for this question (if any); keep hidden until reveal
  state.roundTwo.options = r2ListOptions(id);
  // keep bets, but stage remains
  saveGameState(state);
  broadcast(
    makeEvent("r2:question:selected", { id: state.roundTwo.currentQuestionId })
  );
  return { ok: true, state };
}

export function r2SetQuestionVisible(visible) {
  const state = getGameState();
  state.roundTwo.questionVisible = !!visible;
  if (visible && state.roundTwo.stage === "topic") {
    state.roundTwo.stage = "question"; // allow only increases
  }
  saveGameState(state);
  broadcast(
    makeEvent("r2:question", { visible: state.roundTwo.questionVisible })
  );
  return { ok: true, state };
}

export function r2SetOptions(options = [], visible) {
  const list = Array.isArray(options) ? options.map(String) : [];
  const state = getGameState();
  state.roundTwo.options = list;
  if (typeof visible === "boolean") {
    state.roundTwo.optionsVisible = visible;
    if (visible) state.roundTwo.stage = "options";
  }
  saveGameState(state);
  broadcast(
    makeEvent("r2:options", {
      options: state.roundTwo.options,
      visible: state.roundTwo.optionsVisible,
    })
  );
  return { ok: true, state };
}

export function r2PlaceBet(username, amount) {
  if (!username) return { ok: false, error: "Missing username" };
  ensureTeamStateRows();
  const teams = getTeams();
  const team = teams.find((t) => t.username === username);
  if (!team) return { ok: false, error: "Unknown team" };
  const state = getGameState();
  if (!state.roundTwo.topicId) return { ok: false, error: "Topic not set" };
  if (state.roundTwo.stage !== "topic" && state.roundTwo.stage !== "question") {
    return { ok: false, error: "Betting is closed" };
  }
  const current = Math.max(0, Math.floor(state.roundTwo.bets[team.id] || 0));
  const maxAllowed = Math.min(
    state.roundTwo.maxBet > 0 ? state.roundTwo.maxBet : Number.MAX_SAFE_INTEGER,
    Number(team.score)
  );
  const next = Math.floor(Number(amount) || 0);
  if (next < 0) return { ok: false, error: "Invalid amount" };
  if (state.roundTwo.stage === "question" && next < current) {
    return { ok: false, error: "Cannot decrease bet after question reveal" };
  }
  if (next > maxAllowed) {
    return { ok: false, error: "Bet exceeds allowed maximum or team score" };
  }
  state.roundTwo.bets[team.id] = next;
  saveGameState(state);
  broadcast(makeEvent("r2:bet", { userId: team.id, amount: next }));
  return { ok: true, state };
}

export function r2PlaceBetById(userId, amount) {
  const username = coerceUsername({ userId });
  return r2PlaceBet(username, amount);
}

export function r2SubmitAnswer(username, answer) {
  if (!username) return { ok: false, error: "Missing username" };
  const state = getGameState();
  if (!state.roundTwo.optionsVisible) {
    return { ok: false, error: "Options not revealed" };
  }
  const ans = String(answer ?? "");
  if (state.roundTwo.options.length && !state.roundTwo.options.includes(ans)) {
    return { ok: false, error: "Invalid answer" };
  }
  const u = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  const uid = u?.id || null;
  if (!uid) return { ok: false, error: "Unknown team" };
  state.roundTwo.answers[uid] = ans;
  saveGameState(state);
  broadcast(makeEvent("r2:answer", { userId: uid }));
  return { ok: true, state };
}

export function r2SubmitAnswerById(userId, answer) {
  const username = coerceUsername({ userId });
  return r2SubmitAnswer(username, answer);
}

export function r2RevealAnswer(correctAnswer) {
  // Backward-compatible combined action: reveal then settle
  const r = r2RevealCorrectAnswer(correctAnswer);
  if (r?.ok === false) return r;
  return r2Settle();
}

export function r2RevealCorrectAnswer(correctAnswer) {
  const state = getGameState();
  const correct = String(correctAnswer ?? "");
  state.roundTwo.correctAnswer = correct;
  state.roundTwo.stage = "revealed";
  saveGameState(state);
  broadcast(
    makeEvent("r2:answer:revealed", {
      correctAnswer: correct,
    })
  );
  return { ok: true, state };
}

export function r2Settle() {
  const state = getGameState();
  const correct = String(state.roundTwo.correctAnswer ?? "");
  if (!correct) return { ok: false, error: "Correct answer not set" };

  // Compute winners
  const bets = state.roundTwo.bets || {};
  const answers = state.roundTwo.answers || {};
  const teams = getTeams();
  const teamSet = new Set(teams.map((t) => String(t.id)));
  const bettors = Object.keys(bets).filter((u) => teamSet.has(String(u)));
  const pot = bettors.reduce(
    (sum, u) => sum + Math.max(0, Math.floor(bets[u] || 0)),
    0
  );
  const correctTeams = bettors.filter((u) => (answers[u] ?? "") === correct);

  // Adjust scores in DB: subtract all bets first
  const subtractStmt = db.prepare(
    "UPDATE team_state SET score = score - ? WHERE user_id = ?"
  );
  const addStmt = db.prepare(
    "UPDATE team_state SET score = score + ? WHERE user_id = ?"
  );
  const txn = db.transaction(() => {
    for (const u of bettors) {
      const amt = Math.max(0, Math.floor(bets[u] || 0));
      if (amt > 0) subtractStmt.run(amt, Number(u));
    }
    // Determine distribution
    let winners = [];
    if (correctTeams.length === 1) {
      winners = [correctTeams[0]];
    } else if (correctTeams.length > 1) {
      let maxBet = -1;
      for (const u of correctTeams) {
        maxBet = Math.max(maxBet, Math.max(0, Math.floor(bets[u] || 0)));
      }
      winners = correctTeams.filter(
        (u) => Math.max(0, Math.floor(bets[u] || 0)) === maxBet
      );
    }
    if (winners.length > 0 && pot > 0) {
      const base = Math.floor(pot / winners.length);
      let remainder = pot % winners.length;
      for (const u of winners) {
        const inc = base + (remainder > 0 ? 1 : 0);
        addStmt.run(inc, Number(u));
        if (remainder > 0) remainder -= 1;
      }
    }
  });
  txn();

  const updatedTeams = getTeams();
  broadcast(
    makeEvent("r2:settled", {
      pot,
      teams: updatedTeams,
    })
  );

  // Prepare for next question: clear transient fields
  state.roundTwo.currentQuestionId = null;
  state.roundTwo.currentQuestionText = null;
  state.roundTwo.questionVisible = false;
  state.roundTwo.optionsVisible = false;
  state.roundTwo.options = [];
  state.roundTwo.bets = {};
  state.roundTwo.answers = {};
  state.roundTwo.correctAnswer = null;
  state.roundTwo.maxBet = 0;
  state.roundTwo.stage = state.roundTwo.topicId ? "topic" : "idle";
  saveGameState(state);

  return { ok: true, state, teams: updatedTeams };
}
