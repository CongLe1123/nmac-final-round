"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function AdminGlobalControls({ state, teams, refresh }) {
  const [delta, setDelta] = useState(10);
  const [busy, setBusy] = useState(false);
  const [buzzAllowed, setBuzzAllowed] = useState(state?.buzz?.allowed || false);

  useEffect(() => {
    setBuzzAllowed(state?.buzz?.allowed || false);
  }, [state?.buzz?.allowed]);

  const adjust = async (username, sign) => {
    setBusy(true);
    try {
      await fetch("/api/game/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          delta: (sign === "+" ? 1 : -1) * (Number(delta) || 0),
        }),
      });
      refresh?.();
    } finally {
      setBusy(false);
    }
  };

  const toggleBuzz = async () => {
    const allowed = !buzzAllowed;
    setBuzzAllowed(allowed);
    await fetch("/api/game/buzz/allow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowed }),
    });
  };

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
          <button
            onClick={toggleBuzz}
            className={`rounded-md px-3 py-1 text-white ${
              buzzAllowed
                ? "bg-red-600 hover:bg-red-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {buzzAllowed ? "Disable Buzz" : "Enable Buzz"}
          </button>
          <div className="text-sm text-zinc-600">
            {state?.buzz?.winner
              ? `Buzz winner: ${state.buzz.winner}`
              : buzzAllowed
              ? "Buzz is OPEN"
              : "Buzz is CLOSED"}
          </div>
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
                  onClick={() => adjust(t.username, "+")}
                  className="flex-1 rounded bg-zinc-900 text-white py-1 text-sm"
                >
                  +{delta}
                </button>
                <button
                  disabled={busy}
                  onClick={() => adjust(t.username, "-")}
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
  const [topics, setTopics] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [r2Topic, setR2Topic] = useState("");
  const [r2MaxBet, setR2MaxBet] = useState(0);
  const [r2QuestionId, setR2QuestionId] = useState("");
  const [r2Correct, setR2Correct] = useState("");
  const esRef = useRef(null);

  const fetchState = async () => {
    const res = await fetch("/api/game/state");
    const j = await res.json();
    if (j?.ok) {
      setState(j.state);
      setTeams(j.teams || []);
      setTopics(j.topics || []);
      setR2Topic(j.state?.roundTwo?.topic || "");
      setR2MaxBet(j.state?.roundTwo?.maxBet || 0);
      setR2QuestionId(j.state?.roundTwo?.currentQuestionId || "");
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
        if (data?.type?.startsWith("buzz:"))
          setState((s) => ({ ...s, buzz: { ...s?.buzz, ...data.payload } }));
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
    const topic = state?.roundTwo?.topic || r2Topic;
    if (!topic) return;
    const url = `/api/game/r2/questions?topic=${encodeURIComponent(topic)}`;
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) setQuestions(j.questions || []);
      })
      .catch(() => {});
  }, [state?.roundTwo?.topic, r2Topic]);

  const setRound = async (round) => {
    await fetch("/api/round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ round }),
    });
  };

  if (!ready) return null;

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
                  value={r2Topic}
                  onChange={(e) => setR2Topic(e.target.value)}
                >
                  <option value="">Select topic</option>
                  {topics.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  onClick={async () => {
                    await fetch("/api/game/r2/topic", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ topic: r2Topic }),
                    });
                    fetchState();
                  }}
                  className="rounded bg-blue-600 text-white px-3 py-1"
                >
                  Reveal Topic
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
                    // Allow clearing to 0 (no limit)
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
                  No limit
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
                  {questions
                    .filter(
                      (q) =>
                        !state?.roundTwo?.topic ||
                        q.topic === state?.roundTwo?.topic
                    )
                    .map((q) => (
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
              <div className="font-medium">4) Options</div>
              <div className="flex gap-2 items-center">
                <button
                  onClick={async () => {
                    await fetch("/api/game/r2/options", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        options: state?.roundTwo?.options || [],
                        visible: true,
                      }),
                    });
                    fetchState();
                  }}
                  className="rounded bg-blue-600 text-white px-3 py-1"
                >
                  Reveal Options
                </button>
                <button
                  onClick={async () => {
                    await fetch("/api/game/r2/options", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        options: state?.roundTwo?.options || [],
                        visible: false,
                      }),
                    });
                    fetchState();
                  }}
                  className="rounded border px-3 py-1"
                >
                  Hide Options
                </button>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="font-medium">5) Reveal Answer & Settle</div>
              <div className="flex gap-2">
                <input
                  className="rounded border px-2 py-1"
                  value={r2Correct}
                  onChange={(e) => setR2Correct(e.target.value)}
                  placeholder="Correct answer (must match option)"
                />
                <button
                  onClick={async () => {
                    await fetch("/api/game/r2/reveal-answer", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ answer: r2Correct }),
                    });
                    fetchState();
                  }}
                  className="rounded bg-emerald-600 text-white px-3 py-1"
                >
                  Reveal Answer
                </button>
                <button
                  onClick={async () => {
                    await fetch("/api/game/r2/settle", { method: "POST" });
                    setR2Correct("");
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
                Stage: {state?.roundTwo?.stage}
              </div>
              <div className="text-sm text-zinc-600">
                Question:{" "}
                {state?.roundTwo?.currentQuestionText ||
                  state?.roundTwo?.currentQuestionId ||
                  "(none)"}
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="font-medium mb-2">Bets</div>
              <div className="space-y-1 text-sm">
                {teams.map((t) => (
                  <div key={t.username} className="flex justify-between">
                    <span>{t.username}</span>
                    <span>{state?.roundTwo?.bets?.[t.username] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="font-medium mb-2">Answers</div>
              <div className="space-y-1 text-sm">
                {teams.map((t) => (
                  <div key={t.username} className="flex justify-between">
                    <span>{t.username}</span>
                    <span>{state?.roundTwo?.answers?.[t.username] ?? ""}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
