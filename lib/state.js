import db from "./db";
import { broadcast, makeEvent } from "./events";
import { getQuestionById, QUESTIONS } from "./questions";

// Game-wide constants
export const TOPICS = [
  "Nội khoa",
  "Ngoại khoa",
  "Sản–Nhi",
  "Tâm thần–Thần kinh",
];

// Ensure team_state table exists for scores and hermes usage
db.exec(
  "CREATE TABLE IF NOT EXISTS team_state (username TEXT PRIMARY KEY, score INTEGER NOT NULL DEFAULT 0, hermes_used INTEGER NOT NULL DEFAULT 0)"
);

// Helper: list team users
export function getTeams() {
  const rows = db
    .prepare("SELECT username FROM users WHERE role = 'team'")
    .all();
  const teamRows = rows || [];
  const stateStmt = db.prepare(
    "SELECT username, score, hermes_used FROM team_state WHERE username = ?"
  );
  return teamRows.map((r) => {
    const st = stateStmt.get(r.username) || {
      username: r.username,
      score: 0,
      hermes_used: 0,
    };
    return {
      username: r.username,
      score: st.score ?? 0,
      hermes_used: !!st.hermes_used,
    };
  });
}

// Ensure team_state rows exist for all teams
export function ensureTeamStateRows() {
  const teams = db
    .prepare("SELECT username FROM users WHERE role = 'team'")
    .all();
  const insert = db.prepare(
    "INSERT OR IGNORE INTO team_state (username, score, hermes_used) VALUES (?, 0, 0)"
  );
  const txn = db.transaction((rows) => {
    for (const r of rows) insert.run(r.username);
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
    eligibleSelectors: [], // usernames that can be selected to choose topic
    currentSelector: null, // username currently selecting topic
    selectedTopics: {}, // { username: topic }
    questionVisible: false,
    currentQuestionId: null,
    currentQuestionTopic: null,
    currentTopicSelectedBy: null,
  },
  roundTwo: {
    topic: null,
    maxBet: 0,
    currentQuestionId: null,
    currentQuestionText: null,
    questionVisible: false,
    optionsVisible: false,
    options: [],
    bets: {}, // { username: number }
    answers: {}, // { username: string }
    correctAnswer: null,
    stage: "idle", // idle | betting | question | options | revealed
  },
  buzz: {
    allowed: false,
    winner: null,
    winners: [],
  },
  hermes: {
    lastUsedBy: null, // username of the most recent use (for visible cue)
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
      currentQuestionTopic: null,
      currentTopicSelectedBy: null,
      ...(st.roundOne || {}),
    },
    roundTwo: {
      topic: null,
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
    hermes: { lastUsedBy: null, ...(st.hermes || {}) },
  };
}

function saveGameState(next) {
  setJSON("game_state", next);
  return next;
}

// Score adjustments
export function adjustScore(username, delta) {
  if (!username || !Number.isFinite(delta)) return getTeams();
  const row = db
    .prepare("SELECT username FROM team_state WHERE username = ?")
    .get(username);
  if (!row) return getTeams();
  db.prepare("UPDATE team_state SET score = score + ? WHERE username = ?").run(
    delta,
    username
  );
  const teams = getTeams();
  broadcast(makeEvent("score:update", { teams }));
  return teams;
}

export function setEligibleSelectors(usernames) {
  const state = getGameState();
  state.roundOne.eligibleSelectors = Array.isArray(usernames)
    ? [...new Set(usernames)]
    : [];
  saveGameState(state);
  broadcast(
    makeEvent("r1:eligibility", {
      eligibleSelectors: state.roundOne.eligibleSelectors,
    })
  );
  return state;
}

export function setCurrentSelector(username) {
  const state = getGameState();
  if (!username) state.roundOne.currentSelector = null;
  else state.roundOne.currentSelector = username;
  saveGameState(state);
  broadcast(
    makeEvent("r1:selector", {
      currentSelector: state.roundOne.currentSelector,
    })
  );
  return state;
}

export function getAvailableTopics() {
  const state = getGameState();
  const chosen = new Set(Object.values(state.roundOne.selectedTopics || {}));
  return TOPICS.filter((t) => !chosen.has(t));
}

export function selectTopic(username, topic) {
  const state = getGameState();
  // Must be current selector and topic available
  if (!username || state.roundOne.currentSelector !== username) {
    return { ok: false, error: "Not allowed" };
  }
  if (!TOPICS.includes(topic)) {
    return { ok: false, error: "Invalid topic" };
  }
  const available = getAvailableTopics();
  if (!available.includes(topic)) {
    return { ok: false, error: "Topic already taken" };
  }
  state.roundOne.selectedTopics[username] = topic;
  // Set active topic for question selection and clear any prior question
  state.roundOne.currentQuestionTopic = topic;
  state.roundOne.currentTopicSelectedBy = username;
  state.roundOne.currentQuestionId = null;
  // After picking, clear current selector
  state.roundOne.currentSelector = null;
  saveGameState(state);
  broadcast(
    makeEvent("r1:topic:selected", {
      username,
      topic,
      selectedTopics: state.roundOne.selectedTopics,
      availableTopics: getAvailableTopics(),
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
  if (id && state.roundOne.currentQuestionTopic) {
    if (!q || q.topic !== state.roundOne.currentQuestionTopic) {
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
  const state = getGameState();
  if (!state.buzz.allowed || state.buzz.winner) {
    return { ok: false, error: "Buzz not allowed" };
  }
  // Disallow the team that selected the current topic
  if (username && state.roundOne.currentTopicSelectedBy === username) {
    return { ok: false, error: "Topic selector cannot buzz" };
  }
  // Disallow any previous winners for the current question
  const prev = new Set(state.buzz.winners || []);
  if (username && prev.has(username)) {
    return { ok: false, error: "Previous winner cannot buzz" };
  }
  state.buzz.winner = username;
  state.buzz.allowed = false; // lock after first buzz
  if (username) {
    prev.add(username);
    state.buzz.winners = Array.from(prev);
  }
  saveGameState(state);
  broadcast(makeEvent("buzz:winner", { winner: username, allowed: false }));
  return { ok: true, state };
}

export function useHermes(username) {
  if (!username) return { ok: false, error: "Missing username" };
  // ensure team_state exists
  ensureTeamStateRows();
  const row = db
    .prepare("SELECT hermes_used FROM team_state WHERE username = ?")
    .get(username);
  if (!row) return { ok: false, error: "Unknown team" };
  if (row.hermes_used) return { ok: false, error: "Hermes already used" };
  db.prepare("UPDATE team_state SET hermes_used = 1 WHERE username = ?").run(
    username
  );
  const state = getGameState();
  state.hermes.lastUsedBy = username;
  saveGameState(state);
  const teams = getTeams();
  broadcast(
    makeEvent("hermes:used", {
      username,
      teams,
      lastUsedBy: state.hermes.lastUsedBy,
    })
  );
  return { ok: true, state, teams };
}

export function clearHermesCue() {
  const state = getGameState();
  state.hermes.lastUsedBy = null;
  saveGameState(state);
  broadcast(makeEvent("hermes:cleared", {}));
  return { ok: true, state };
}

// =======================
// Round Two helpers
// =======================

export function r2SetTopic(topic) {
  if (!topic || !TOPICS.includes(topic)) {
    return { ok: false, error: "Invalid topic" };
  }
  const state = getGameState();
  state.roundTwo.topic = topic;
  state.roundTwo.maxBet = 0;
  state.roundTwo.currentQuestionId = null;
  state.roundTwo.currentQuestionText = null;
  state.roundTwo.questionVisible = false;
  state.roundTwo.optionsVisible = false;
  state.roundTwo.options = [];
  state.roundTwo.bets = {};
  state.roundTwo.answers = {};
  state.roundTwo.correctAnswer = null;
  state.roundTwo.stage = "betting";
  // Auto-select first question for this topic and preload options
  const list = r2ListQuestions(topic);
  if (list.length > 0) {
    const q = list[0];
    state.roundTwo.currentQuestionId = q.id;
    state.roundTwo.currentQuestionText = q.text || null;
    state.roundTwo.options = r2ListOptions(q.id);
  }
  saveGameState(state);
  broadcast(makeEvent("r2:topic", { topic }));
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

export function r2ListQuestions(topic = null) {
  const stmt = topic
    ? db.prepare(
        "SELECT id, topic, text FROM r2_questions WHERE topic = ? ORDER BY id"
      )
    : db.prepare("SELECT id, topic, text FROM r2_questions ORDER BY id");
  return (topic ? stmt.all(topic) : stmt.all()) || [];
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
  let text = null;
  if (id && !r1q) {
    const row = db
      .prepare("SELECT topic, text FROM r2_questions WHERE id = ?")
      .get(id);
    if (!row) return { ok: false, error: "Invalid question id" };
    topic = row.topic;
    text = row.text || null;
  } else if (r1q) {
    topic = r1q.topic;
    text = r1q.text || null;
  }
  const state = getGameState();
  if (id && state.roundTwo.topic && topic && topic !== state.roundTwo.topic) {
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
  if (visible && state.roundTwo.stage === "betting") {
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
  if (!state.roundTwo.topic) return { ok: false, error: "Topic not set" };
  if (
    state.roundTwo.stage !== "betting" &&
    state.roundTwo.stage !== "question"
  ) {
    return { ok: false, error: "Betting is closed" };
  }
  const current = Math.max(0, Math.floor(state.roundTwo.bets[username] || 0));
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
  state.roundTwo.bets[username] = next;
  saveGameState(state);
  broadcast(makeEvent("r2:bet", { username, amount: next }));
  return { ok: true, state };
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
  state.roundTwo.answers[username] = ans;
  saveGameState(state);
  broadcast(makeEvent("r2:answer", { username }));
  return { ok: true, state };
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
  const teamSet = new Set(teams.map((t) => t.username));
  const bettors = Object.keys(bets).filter((u) => teamSet.has(u));
  const pot = bettors.reduce(
    (sum, u) => sum + Math.max(0, Math.floor(bets[u] || 0)),
    0
  );
  const correctTeams = bettors.filter((u) => (answers[u] ?? "") === correct);

  // Adjust scores in DB: subtract all bets first
  const subtractStmt = db.prepare(
    "UPDATE team_state SET score = score - ? WHERE username = ?"
  );
  const addStmt = db.prepare(
    "UPDATE team_state SET score = score + ? WHERE username = ?"
  );
  const txn = db.transaction(() => {
    for (const u of bettors) {
      const amt = Math.max(0, Math.floor(bets[u] || 0));
      if (amt > 0) subtractStmt.run(amt, u);
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
        addStmt.run(inc, u);
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
  state.roundTwo.stage = state.roundTwo.topic ? "betting" : "idle";
  saveGameState(state);

  return { ok: true, state, teams: updatedTeams };
}
