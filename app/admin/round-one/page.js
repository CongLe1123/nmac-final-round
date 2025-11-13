"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const TOPIC_LABELS = [
  "Nội khoa",
  "Ngoại khoa",
  "Sản–Nhi",
  "Tâm thần–Thần kinh",
];

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
              {t.hermes_used ? (
                <div className="text-xs text-emerald-600">Hermes used</div>
              ) : (
                <div className="text-xs text-zinc-500">Hermes available</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {state?.hermes?.lastUsedBy && (
        <div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-amber-900 flex items-center justify-between">
          <div>
            Hermes Shoes activated by: <b>{state.hermes.lastUsedBy}</b>
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
  const [availableTopics, setAvailableTopics] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionId, setCurrentQuestionId] = useState(null);
  const esRef = useRef(null);

  const fetchState = async () => {
    const res = await fetch("/api/game/state");
    const j = await res.json();
    if (j?.ok) {
      setState(j.state);
      setTeams(j.teams || []);
      setAvailableTopics(j.availableTopics || []);
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
              currentQuestionTopic: data.payload.topic,
              currentQuestionId: null,
            },
          }));
          setAvailableTopics(data.payload.availableTopics || []);
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
            hermes: { ...s?.hermes, lastUsedBy: data.payload.username },
          }));
          fetchState();
        }
        if (data?.type === "hermes:cleared") {
          setState((s) => ({
            ...s,
            hermes: { ...s?.hermes, lastUsedBy: null },
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

  const setSelector = async (username) => {
    await fetch("/api/game/r1/selector", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
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

  const eligible = new Set(state?.roundOne?.eligibleSelectors || []);
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
                    key={t.username}
                    className="flex items-center gap-2 border rounded p-2"
                  >
                    <input
                      type="checkbox"
                      checked={eligible.has(t.username)}
                      onChange={(e) => {
                        const next = new Set(eligible);
                        if (e.target.checked) next.add(t.username);
                        else next.delete(t.username);
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
                  onChange={(e) => setSelector(e.target.value || null)}
                >
                  <option value="">— none —</option>
                  {Array.from(eligible).map((u) => (
                    <option key={u} value={u}>
                      {u}
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

            <div className="rounded-md border p-4">
              <div className="font-medium mb-2">Topics</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {TOPIC_LABELS.map((topic) => {
                  const takenBy =
                    Object.entries(selectedTopics).find(
                      ([, tp]) => tp === topic
                    )?.[0] || null;
                  return (
                    <div
                      key={topic}
                      className={`rounded p-2 border ${
                        takenBy ? "opacity-60" : ""
                      }`}
                    >
                      <div className="font-semibold">{topic}</div>
                      <div className="text-xs text-zinc-600">
                        {takenBy ? `Taken by ${takenBy}` : "Available"}
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
              {state?.roundOne?.currentQuestionTopic ? (
                <>
                  <div className="mb-2 text-sm text-zinc-700">
                    Only showing questions for:
                    <span className="ml-1 font-semibold">
                      {state.roundOne.currentQuestionTopic}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {questions
                      .filter(
                        (q) => q.topic === state.roundOne.currentQuestionTopic
                      )
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

        {state?.hermes?.lastUsedBy && (
          <div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-amber-900 flex items-center justify-between">
            <div>
              Hermes Shoes activated by: <b>{state.hermes.lastUsedBy}</b>
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
