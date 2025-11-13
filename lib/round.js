import db from "./db";

// Valid rounds and their corresponding paths
export const VALID_ROUNDS = ["pre-round-one", "round-one", "round-two"];
export const roundPath = (round) => {
  switch (round) {
    case "pre-round-one":
      return "/pre-round-one";
    case "round-one":
      return "/round-one";
    case "round-two":
      return "/round-two";
    default:
      return "/pre-round-one";
  }
};

// Simple in-memory pub-sub for SSE
const subscribers = new Set();

function broadcast(round) {
  for (const send of [...subscribers]) {
    try {
      send(round);
    } catch {
      subscribers.delete(send);
    }
  }
}

export function subscribe(send) {
  subscribers.add(send);
  return () => subscribers.delete(send);
}

export function getCurrentRound() {
  const row = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get("current_round");
  const round = row?.value || "pre-round-one";
  if (!VALID_ROUNDS.includes(round)) return "pre-round-one";
  return round;
}

export function setCurrentRound(round) {
  if (!VALID_ROUNDS.includes(round)) {
    throw new Error("Invalid round");
  }
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).run("current_round", round);
  broadcast(round);
  return round;
}
