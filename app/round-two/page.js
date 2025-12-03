"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function RoundTwoPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [userId, setUserId] = useState(null);
  const [state, setState] = useState(null);
  const [teams, setTeams] = useState([]);
  const [r2Topics, setR2Topics] = useState([]);
  const [bet, setBet] = useState("");
  const [answerText, setAnswerText] = useState("");
  const esRef = useRef(null);

  useEffect(() => {
    const role = localStorage.getItem("role");
    const user = localStorage.getItem("name");
    const uid = localStorage.getItem("userId");

    if (!role || !uid) {
      router.replace("/login");
      return;
    }

    if (role === "admin") {
      router.replace("/admin");
      return;
    }

    setName(user);
    setUserId(Number(uid));
    setReady(true);

    // Ensure correct page on mount
    fetch("/api/round")
      .then((r) => r.json())
      .then((j) => {
        const round = j?.round;
        const path =
          round === "pre-round-one"
            ? "/pre-round-one"
            : round === "round-two"
            ? "/round-two"
            : "/round-one";
        if (path !== "/round-two") router.replace(path);
      })
      .catch(() => {});

    // Subscribe for live changes
    const es = new EventSource("/api/round/stream");
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        const round = data?.round;
        if (!round) return;
        const path =
          round === "pre-round-one"
            ? "/pre-round-one"
            : round === "round-two"
            ? "/round-two"
            : "/round-one";
        if (path !== "/round-two") router.replace(path);
      } catch {}
    };
    es.onerror = () => {};

    // Subscribe to game events
    const esGame = new EventSource("/api/game/stream");
    esRef.current = esGame;
    esGame.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data?.type === "init") {
          setState(data.payload);
          // also fetch teams snapshot
          fetch("/api/game/state")
            .then((r) => r.json())
            .then((j) => {
              if (j?.ok) {
                setState(j.state);
                setTeams(j.teams || []);
                setR2Topics(j.r2Topics || []);
              }
            })
            .catch(() => {});
        }
        // Buzz events ignored in Round Two
        if (String(data?.type || "").startsWith("r2:")) {
          // Refresh full state for r2 changes
          fetch("/api/game/state")
            .then((r) => r.json())
            .then((j) => {
              if (j?.ok) {
                setState(j.state);
                setTeams(j.teams || []);
              }
            })
            .catch(() => {});
        }
      } catch {}
    };

    return () => {
      es.close();
      esGame.close();
    };
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    const currentAnswer = state?.roundTwo?.answers?.[userId];
    setAnswerText(currentAnswer != null ? String(currentAnswer) : "");
  }, [state?.roundTwo?.answers, userId]);

  const logout = () => {
    localStorage.removeItem("role");
    localStorage.removeItem("name");
    router.replace("/login");
  };

  const placeBet = async () => {
    await fetch("/api/game/r2/bet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, amount: Number(bet) || 0 }),
    });
  };

  const submitAnswer = async (answer) => {
    await fetch("/api/game/r2/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, answer }),
    });
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen flex items-start justify-center p-6">
      <div className="max-w-2xl w-full">
        <h1 className="text-2xl font-semibold mb-4">Welcome, {name}</h1>
        <p className="mb-4 text-zinc-600">This is Round Two.</p>

        {/* Buzz controls removed for Round Two */}

        {/* Round Two flow */}
        <div className="rounded-md border p-4 space-y-4 mb-6">
          <div className="text-lg font-medium">Round 2</div>
          {state?.roundTwo?.topicVisible && state?.roundTwo?.topicId ? (
            <div className="text-sm text-zinc-600">
              Topic:{" "}
              {(() => {
                const tid = state?.roundTwo?.topicId;
                const t = (r2Topics || []).find((x) => x.id === tid);
                return t?.name || "";
              })()}
            </div>
          ) : null}
          {state?.roundTwo?.maxBet > 0 ? (
            <div className="text-sm text-zinc-600">
              Max bet: {state?.roundTwo?.maxBet}
            </div>
          ) : null}
          <div className="text-sm text-zinc-600">
            Your score: {teams.find((t) => t.id === userId)?.score ?? 0}
          </div>

          {state?.roundTwo?.topicVisible &&
            state?.roundTwo?.maxBet > 0 &&
            (state?.roundTwo?.stage === "topic" ||
              state?.roundTwo?.stage === "question") && (
              <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  const teamScore =
                    teams.find((t) => t.id === userId)?.score ?? 0;
                  const limit = state.roundTwo.maxBet;
                  const maxAllowed = Math.min(limit, Number(teamScore));
                  const currentBet = Number(
                    state?.roundTwo?.bets?.[userId] ?? 0
                  );
                  let buttons = [];
                  for (let v = 10; v <= maxAllowed; v += 10) buttons.push(v);
                  if (state?.roundTwo?.stage !== "topic") {
                    // After topic stage, only allow increases
                    buttons = buttons.filter((v) => v >= currentBet);
                  }
                  if (buttons.length === 0) {
                    return (
                      <div className="text-sm text-zinc-600">
                        No valid bet options.
                      </div>
                    );
                  }
                  return buttons.map((v) => (
                    <button
                      key={v}
                      onClick={async () => {
                        setBet(String(v));
                        await fetch("/api/game/r2/bet", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ userId, amount: v }),
                        });
                      }}
                      className={`rounded border px-3 py-1 ${
                        (state?.roundTwo?.bets?.[userId] ?? 0) === v
                          ? "bg-zinc-900 text-white"
                          : ""
                      }`}
                    >
                      {v}
                    </button>
                  ));
                })()}
                <div className="text-sm text-zinc-600 ml-2">
                  Current bet: {state?.roundTwo?.bets?.[userId] ?? 0}
                </div>
              </div>
            )}

          {state?.roundTwo?.questionVisible && (
            <div className="rounded border p-3">
              <div className="font-medium">Question</div>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                // className="markdown-body text-sm text-zinc-900 whitespace-pre-wrap"
              >
                {state?.roundTwo?.currentQuestionText || "(no text)"}
              </ReactMarkdown>
              <div className="text-xs text-zinc-500">
                ID: {state?.roundTwo?.currentQuestionId || "(none)"}
              </div>
              <div className="text-xs text-zinc-500">
                You may increase your bet, not decrease.
              </div>
            </div>
          )}

          {state?.roundTwo?.questionVisible &&
            state?.roundTwo?.answerWindowOpen && (
              <div className="rounded border p-3 space-y-3">
                <div className="font-medium">Submit Your Answer</div>
                <textarea
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Type your answer here"
                  rows={3}
                  className="w-full rounded border px-3 py-2 text-sm"
                  disabled={state?.roundTwo?.stage === "revealed"}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={async () => {
                      await submitAnswer(answerText);
                    }}
                    className="rounded bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-800 disabled:opacity-60"
                    disabled={state?.roundTwo?.stage === "revealed"}
                  >
                    Submit Answer
                  </button>
                  <button
                    onClick={async () => {
                      setAnswerText("");
                      await submitAnswer("");
                    }}
                    className="rounded border px-4 py-2 text-sm"
                    disabled={state?.roundTwo?.stage === "revealed"}
                  >
                    Clear
                  </button>
                </div>
                <div className="text-sm text-zinc-600">
                  Submitted answer:{" "}
                  {state?.roundTwo?.answers?.[userId] || "(none)"}
                </div>
              </div>
            )}
          {state?.roundTwo?.answers?.[userId] &&
            !state?.roundTwo?.answerWindowOpen && (
              <div className="rounded border p-3 text-sm text-zinc-600">
                Submitted answer: {state.roundTwo.answers[userId]}
              </div>
            )}
          {state?.roundTwo?.correctAnswer && (
            <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              Correct answer: {state.roundTwo.correctAnswer}
            </div>
          )}
        </div>
        {/* <div className="flex gap-3">
          <button
            onClick={() => router.push("/change-password")}
            className="rounded-md border border-zinc-300 px-4 py-2 text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Change password
          </button>
          <button
            onClick={logout}
            className="rounded-md bg-black px-4 py-2 text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Log out
          </button>
        </div> */}
      </div>
    </div>
  );
}
