"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function AdminGlobalControls({ state, teams, refresh }) {
  const [delta, setDelta] = useState(10);
  const [busy, setBusy] = useState(false);

  const adjust = async (userId, sign) => {
    setBusy(true);
    try {
      await fetch("/api/game/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          delta: (sign === "+" ? 1 : -1) * (Number(delta) || 0),
        }),
      });
      refresh?.();
    } finally {
      setBusy(false);
    }
  };

  // Buzz controls removed for Round Two

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-3">
        <div className="flex items-center gap-3 mb-3">
          <label className="text-sm">Score delta</label>
          <input
            className="w-20 rounded-md border px-2 py-1"
            type="number"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
          />
          {/* Buzz controls/status removed in Round Two */}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {teams.map((t) => (
            <div
              key={t.username}
              className="border rounded p-2 flex flex-col gap-1"
            >
              <div className="font-medium">{t.username}</div>
              <div className="text-sm">Score: {t.score}</div>
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => adjust(t.id, "+")}
                  className="flex-1 rounded bg-zinc-900 text-white py-1 text-sm"
                >
                  +{delta}
                </button>
                <button
                  disabled={busy}
                  onClick={() => adjust(t.id, "-")}
                  className="flex-1 rounded border py-1 text-sm"
                >
                  -{delta}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminRoundTwoPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [state, setState] = useState(null);
  const [teams, setTeams] = useState([]);
  const [r2Topics, setR2Topics] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [r2TopicId, setR2TopicId] = useState("");
  const [r2MaxBet, setR2MaxBet] = useState(0);
  const [r2QuestionId, setR2QuestionId] = useState("");
  const [manualCorrectIds, setManualCorrectIds] = useState([]);
  // Correct answer is stored in DB and auto-revealed; no local input needed
  const esRef = useRef(null);

  const fetchState = async () => {
    const res = await fetch("/api/game/state");
    const j = await res.json();
    if (j?.ok) {
      setState(j.state);
      setTeams(j.teams || []);
      setR2Topics(j.r2Topics || []);
      setR2TopicId(j.state?.roundTwo?.topicId || "");
      setR2MaxBet(j.state?.roundTwo?.maxBet || 0);
      setR2QuestionId(j.state?.roundTwo?.currentQuestionId || "");
      setManualCorrectIds(
        Array.isArray(j.state?.roundTwo?.manualCorrectUserIds)
          ? j.state.roundTwo.manualCorrectUserIds.map((id) => Number(id))
          : []
      );
    }
  };

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "admin") {
      router.replace("/round-two");
      return;
    }
    setReady(true);
    fetchState();
    const es = new EventSource("/api/game/stream");
    esRef.current = es;
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data?.type === "init") setState(data.payload);
        if (data?.type === "score:update") fetchState();
        if (String(data?.type || "").startsWith("r2:")) {
          fetchState();
        }
      } catch {}
    };
    return () => es.close();
  }, [router]);

  // Auto-load questions from DB whenever topic is chosen/changes
  useEffect(() => {
    const topicId = state?.roundTwo?.topicId || r2TopicId;
    if (!topicId) return;
    const url = `/api/game/r2/questions?topicId=${encodeURIComponent(topicId)}`;
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) setQuestions(j.questions || []);
      })
      .catch(() => {});
  }, [state?.roundTwo?.topicId, r2TopicId]);

  const setRound = async (round) => {
    await fetch("/api/round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ round }),
    });
  };

  const persistManualCorrect = async (ids) => {
    const list = Array.isArray(ids) ? ids : [];
    await fetch("/api/game/r2/correct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userIds: list
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id)),
      }),
    });
    fetchState();
  };

  const clearManualCorrect = async () => {
    setManualCorrectIds([]);
    await persistManualCorrect([]);
  };

  const toggleManualCorrect = (userId) => {
    const id = Number(userId);
    setManualCorrectIds((prev) => {
      const set = new Set(prev.map((v) => Number(v)));
      if (set.has(id)) set.delete(id);
      else set.add(id);
      const next = Array.from(set);
      persistManualCorrect(next);
      return next;
    });
  };

  if (!ready) return null;

  const manualCorrectSet = new Set(
    manualCorrectIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
  );

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Admin • Round Two</h1>
          <div className="flex gap-2">
            <a href="/admin/pre-round-one" className="px-3 py-1 rounded border">
              Pre-R1
            </a>
            <a href="/admin/round-one" className="px-3 py-1 rounded border">
              Round 1
            </a>
            <a href="/admin/round-two" className="px-3 py-1 rounded border">
              Round 2
            </a>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setRound("round-one")}
            className="rounded border px-3 py-1"
          >
            Prev
          </button>
          <button
            onClick={() => setRound("pre-round-one")}
            className="rounded border px-3 py-1"
          >
            Go Pre-R1
          </button>
        </div>

        <AdminGlobalControls state={state} teams={teams} refresh={fetchState} />

        {/* Round 2 Controls */}
        <div className="rounded-md border p-4 space-y-4">
          <div className="text-lg font-semibold">Round 2 Controls</div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="font-medium">1) Reveal Topic</div>
              <div className="flex gap-2">
                <select
                  className="rounded border px-2 py-1"
                  value={r2TopicId}
                  onChange={(e) => setR2TopicId(e.target.value)}
                >
                  <option value="">Select topic</option>
                  <option value="">(None)</option>
                  {(r2Topics || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={async () => {
                    const topicId = Number(r2TopicId);
                    await fetch("/api/game/r2/topic", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ topicId }),
                    });
                    if (topicId > 0) {
                      await fetch("/api/game/r2/reveal-topic", {
                        method: "POST",
                      });
                    }
                    fetchState();
                  }}
                  className="rounded bg-blue-600 text-white px-3 py-1"
                >
                  Apply Topic
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-medium">2) Set Max Bet</div>
              <div className="flex gap-2 flex-wrap">
                {[40, 50, 60, 70, 80].map((v) => (
                  <button
                    key={v}
                    onClick={async () => {
                      setR2MaxBet(v);
                      await fetch("/api/game/r2/max-bet", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ maxBet: v }),
                      });
                      fetchState();
                    }}
                    className={`rounded border px-3 py-1 ${
                      Number(state?.roundTwo?.maxBet || 0) === v
                        ? "bg-zinc-900 text-white"
                        : ""
                    }`}
                  >
                    {v}
                  </button>
                ))}
                <button
                  onClick={async () => {
                    setR2MaxBet(0);
                    await fetch("/api/game/r2/max-bet", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ maxBet: 0 }),
                    });
                    fetchState();
                  }}
                  className={`rounded border px-3 py-1 ${
                    Number(state?.roundTwo?.maxBet || 0) === 0
                      ? "bg-zinc-900 text-white"
                      : ""
                  }`}
                >
                  0
                </button>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="font-medium">3) Select Question</div>
              <div className="flex gap-2 items-center">
                <select
                  className="rounded border px-2 py-1 flex-1"
                  value={r2QuestionId}
                  onChange={(e) => setR2QuestionId(e.target.value)}
                >
                  <option value="">Select question</option>
                  {questions.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.id} • {q.text}
                    </option>
                  ))}
                </select>
                {/* Questions auto-load from DB when topic changes */}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    const currentlyVisible = !!state?.roundTwo?.questionVisible;
                    if (!currentlyVisible) {
                      // When revealing, also set the selected question id first
                      if (r2QuestionId) {
                        await fetch("/api/game/r2/question", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: r2QuestionId }),
                        });
                      }
                      await fetch("/api/game/r2/question", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ visible: true }),
                      });
                    } else {
                      // Hiding question
                      await fetch("/api/game/r2/question", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ visible: false }),
                      });
                    }
                    fetchState();
                  }}
                  className={`rounded px-3 py-1 text-white ${
                    state?.roundTwo?.questionVisible
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {state?.roundTwo?.questionVisible
                    ? "Hide Question"
                    : "Reveal Question"}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-medium">4) Answer Window</div>
              <div className="flex gap-2 items-center">
                <button
                  onClick={async () => {
                    await fetch("/api/game/r2/answer-window", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ visible: true }),
                    });
                    fetchState();
                  }}
                  className="rounded bg-blue-600 text-white px-3 py-1"
                >
                  Open Answers
                </button>
                <button
                  onClick={async () => {
                    await fetch("/api/game/r2/answer-window", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ visible: false }),
                    });
                    fetchState();
                  }}
                  className="rounded border px-3 py-1"
                >
                  Close Answers
                </button>
              </div>
              <div className="text-xs text-zinc-500">
                Teams can submit answers only while the window is open.
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="font-medium">5) Reveal Answer & Settle</div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await fetch("/api/game/r2/reveal-answer", {
                      method: "POST",
                    });
                    fetchState();
                  }}
                  className="rounded bg-emerald-600 text-white px-3 py-1"
                >
                  Reveal Answer (from DB)
                </button>
                <button
                  onClick={async () => {
                    await fetch("/api/game/r2/settle", { method: "POST" });
                    fetchState();
                  }}
                  className="rounded bg-fuchsia-600 text-white px-3 py-1"
                >
                  Settle Scores
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-medium">Status</div>
              <div className="text-sm text-zinc-600">
                Stage:{" "}
                {state?.roundTwo?.stage === "topic"
                  ? "topic (bets open)"
                  : state?.roundTwo?.stage}
              </div>
              <div className="text-sm text-zinc-600">
                Question:{" "}
                {state?.roundTwo?.currentQuestionText ||
                  state?.roundTwo?.currentQuestionId ||
                  "(none)"}
              </div>
              <div className="text-sm text-zinc-600">
                Answer window:{" "}
                {state?.roundTwo?.answerWindowOpen ? "open" : "closed"}
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="font-medium mb-2">Bets</div>
              <div className="space-y-1 text-sm">
                {teams.map((t) => (
                  <div key={t.id} className="flex justify-between">
                    <span>{t.username}</span>
                    <span>{state?.roundTwo?.bets?.[t.id] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="font-medium mb-2">Answers</div>
              <div className="space-y-2 text-sm">
                {teams.map((t) => {
                  const answer = state?.roundTwo?.answers?.[t.id] ?? "";
                  const isCorrect = manualCorrectSet.has(Number(t.id));
                  return (
                    <div
                      key={t.id}
                      className="rounded border px-3 py-2 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-zinc-800">
                            {t.username}
                          </div>
                          <div className="mt-1 whitespace-pre-wrap text-zinc-600">
                            {answer || "(no answer)"}
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-emerald-700">
                          <input
                            type="checkbox"
                            checked={isCorrect}
                            onChange={() => toggleManualCorrect(t.id)}
                          />
                          Correct
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <button
                  onClick={clearManualCorrect}
                  className="rounded border px-3 py-1"
                >
                  Clear Selection
                </button>
                <span className="text-xs text-zinc-500">
                  Checked teams override automatic answer matching when settling
                  scores.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
