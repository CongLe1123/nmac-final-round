"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function AdminGlobalControls({ state, teams, refresh }) {
  const [delta, setDelta] = useState(10);
  const [busy, setBusy] = useState(false);
  const [buzzAllowed, setBuzzAllowed] = useState(state?.buzz?.allowed || false);

  useEffect(() => {
    setBuzzAllowed(state?.buzz?.allowed || false);
  }, [state?.buzz?.allowed]);

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
            {(() => {
              const winnerId = state?.buzz?.winner;
              const winnerName = teams.find((t) => t.id === winnerId)?.username;
              if (winnerId) return `Buzz winner: ${winnerName || winnerId}`;
              return buzzAllowed ? "Buzz is OPEN" : "Buzz is CLOSED";
            })()}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {teams.map((t) => (
            <div key={t.id} className="border rounded p-2 flex flex-col gap-1">
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
              {t.hermes_used ? (
                <div className="text-xs text-emerald-600">Hermes used</div>
              ) : (
                <div className="text-xs text-zinc-500">Hermes available</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {state?.hermes?.lastUsedById && (
        <div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-amber-900 flex items-center justify-between">
          <div>
            Hermes Shoes activated by:{" "}
            <b>
              {teams.find((t) => t.id === state.hermes.lastUsedById)
                ?.username || state.hermes.lastUsedById}
            </b>
          </div>
          <button
            onClick={async () => {
              await fetch("/api/game/hermes/clear", { method: "POST" });
              refresh?.();
            }}
            className="ml-3 rounded border px-3 py-1 text-amber-900 border-amber-400 hover:bg-amber-100"
          >
            Clear cue
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminRoundOnePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [state, setState] = useState(null);
  const [teams, setTeams] = useState([]);
  const [r1Topics, setR1Topics] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionId, setCurrentQuestionId] = useState(null);
  const esRef = useRef(null);

  const fetchState = async () => {
    const res = await fetch("/api/game/state");
    const j = await res.json();
    if (j?.ok) {
      setState(j.state);
      setTeams(j.teams || []);
      setR1Topics(j.r1Topics || []);
    }
  };

  const fetchQuestions = async () => {
    const res = await fetch("/api/game/r1/questions");
    const j = await res.json();
    if (j?.ok) {
      setQuestions(j.questions || []);
      setCurrentQuestionId(j.currentQuestionId || null);
    }
  };

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "admin") {
      router.replace("/round-one");
      return;
    }
    setReady(true);
    fetchState();
    fetchQuestions();
    const es = new EventSource("/api/game/stream");
    esRef.current = es;
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data?.type === "init") setState(data.payload);
        if (data?.type === "r1:eligibility")
          setState((s) => ({
            ...s,
            roundOne: {
              ...s?.roundOne,
              eligibleSelectors: data.payload.eligibleSelectors,
            },
          }));
        if (data?.type === "r1:selector")
          setState((s) => ({
            ...s,
            roundOne: {
              ...s?.roundOne,
              currentSelector: data.payload.currentSelector,
            },
          }));
        if (data?.type === "r1:topic:selected") {
          setState((s) => ({
            ...s,
            roundOne: {
              ...s?.roundOne,
              selectedTopics: data.payload.selectedTopics,
              currentSelector: null,
              currentQuestionTopicId: data.payload.topicId,
              currentQuestionId: null,
            },
          }));
        }
        if (data?.type === "r1:question")
          setState((s) => ({
            ...s,
            roundOne: { ...s?.roundOne, questionVisible: data.payload.visible },
          }));
        if (data?.type === "r1:question:selected") {
          const id = data?.payload?.id || null;
          setCurrentQuestionId(id);
        }
        if (data?.type?.startsWith("buzz:"))
          setState((s) => ({ ...s, buzz: { ...s?.buzz, ...data.payload } }));
        if (data?.type === "score:update") fetchState();
        if (data?.type === "hermes:used") {
          setState((s) => ({
            ...s,
            hermes: { ...s?.hermes, lastUsedById: data.payload.userId },
          }));
          fetchState();
        }
        if (data?.type === "hermes:cleared") {
          setState((s) => ({
            ...s,
            hermes: { ...s?.hermes, lastUsedById: null },
          }));
        }
      } catch {}
    };
    return () => es.close();
  }, [router]);

  const setRound = async (round) => {
    await fetch("/api/round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ round }),
    });
  };

  const updateEligibility = async (eligible) => {
    await fetch("/api/game/r1/eligibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eligible }),
    });
  };

  const setSelector = async (userId) => {
    await fetch("/api/game/r1/selector", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
  };

  const toggleQuestion = async () => {
    const visible = !state?.roundOne?.questionVisible;
    await fetch("/api/game/r1/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visible }),
    });
  };

  const selectQuestion = async (id) => {
    await fetch("/api/game/r1/question/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  };

  if (!ready) return null;

  const eligible = new Set(
    (state?.roundOne?.eligibleSelectors || []).map((x) => Number(x))
  );
  const selectedTopics = state?.roundOne?.selectedTopics || {};
  const currentSelector = state?.roundOne?.currentSelector || null;

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Admin • Round One</h1>
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
            onClick={() => setRound("pre-round-one")}
            className="rounded border px-3 py-1"
          >
            Prev
          </button>
          <button
            onClick={() => setRound("round-two")}
            className="rounded border px-3 py-1"
          >
            Next
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-md border p-4">
              <div className="font-medium mb-2">
                Eligible teams to select topic
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {teams.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-2 border rounded p-2"
                  >
                    <input
                      type="checkbox"
                      checked={eligible.has(Number(t.id))}
                      onChange={(e) => {
                        const next = new Set(eligible);
                        if (e.target.checked) next.add(Number(t.id));
                        else next.delete(Number(t.id));
                        updateEligibility(Array.from(next));
                      }}
                    />
                    <span>{t.username}</span>
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="text-sm">Current selector:</div>
                <select
                  className="rounded-md border px-2 py-1"
                  value={currentSelector || ""}
                  onChange={(e) => setSelector(Number(e.target.value) || null)}
                >
                  <option value="">— none —</option>
                  {teams
                    .filter((t) => eligible.has(Number(t.id)))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.username}
                      </option>
                    ))}
                </select>
                <button
                  onClick={() => setSelector(null)}
                  className="rounded border px-3 py-1"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-md border p-4">
              <div className="font-medium mb-2">Topics</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {(r1Topics || []).map((tp) => {
                  const takenById =
                    Object.entries(selectedTopics).find(
                      ([, tId]) => Number(tId) === Number(tp.id)
                    )?.[0] || null;
                  const takenByName = teams.find(
                    (t) => String(t.id) === String(takenById)
                  )?.username;
                  return (
                    <div
                      key={tp.id}
                      className={`rounded p-2 border ${
                        takenById ? "opacity-60" : ""
                      }`}
                    >
                      <div className="font-semibold">{tp.name}</div>
                      <div className="text-xs text-zinc-600">
                        {takenById
                          ? `Taken by ${takenByName || takenById}`
                          : "Available"}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={toggleQuestion}
                className="rounded bg-indigo-600 text-white px-3 py-1"
              >
                {state?.roundOne?.questionVisible
                  ? "Hide Question"
                  : "Show Question"}
              </button>
            </div>

            <div className="rounded-md border p-4">
              <div className="font-medium mb-2">Select Question</div>
              <div className="mb-3 text-sm text-zinc-700">
                Current:{" "}
                {currentQuestionId ? (
                  <span className="font-mono px-2 py-1 rounded bg-zinc-100 border">
                    {currentQuestionId}
                  </span>
                ) : (
                  <span className="italic text-zinc-500">none</span>
                )}
              </div>
              {state?.roundOne?.currentQuestionTopicId ? (
                <>
                  <div className="mb-2 text-sm text-zinc-700">
                    Only showing questions for:
                    <span className="ml-1 font-semibold">
                      {(() => {
                        const tId = state.roundOne.currentQuestionTopicId;
                        const t = (r1Topics || []).find((x) => x.id === tId);
                        return t?.name || tId;
                      })()}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {questions
                      .filter((q) => {
                        const tId = state.roundOne.currentQuestionTopicId;
                        const t = (r1Topics || []).find((x) => x.id === tId);
                        return t ? q.topic === t.name : false;
                      })
                      .map((q) => (
                        <div
                          key={q.id}
                          className={`border rounded p-2 flex items-center justify-between ${
                            currentQuestionId === q.id
                              ? "border-indigo-500 bg-indigo-50"
                              : ""
                          }`}
                        >
                          <div>
                            <div className="text-sm font-medium">{q.text}</div>
                            <div className="text-xs text-zinc-500 font-mono">
                              {q.id}
                            </div>
                          </div>
                          <button
                            onClick={() => selectQuestion(q.id)}
                            className={`ml-2 rounded px-3 py-1 text-sm ${
                              currentQuestionId === q.id
                                ? "bg-zinc-200 text-zinc-700"
                                : "bg-zinc-900 text-white hover:bg-zinc-800"
                            }`}
                          >
                            {currentQuestionId === q.id ? "Selected" : "Select"}
                          </button>
                        </div>
                      ))}
                  </div>
                </>
              ) : (
                <div className="text-sm text-zinc-500">
                  Waiting for a team to choose a topic...
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <AdminGlobalControls
              state={state}
              teams={teams}
              refresh={fetchState}
            />
          </div>
        </div>

        {state?.hermes?.lastUsedById && (
          <div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-amber-900 flex items-center justify-between">
            <div>
              Hermes Shoes activated by:{" "}
              <b>
                {teams.find((t) => t.id === state.hermes.lastUsedById)
                  ?.username || state.hermes.lastUsedById}
              </b>
            </div>
            <button
              onClick={async () => {
                await fetch("/api/game/hermes/clear", { method: "POST" });
                fetchState();
              }}
              className="ml-3 rounded border px-3 py-1 text-amber-900 border-amber-400 hover:bg-amber-100"
            >
              Clear cue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
