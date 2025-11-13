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
        <div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-amber-900">
          Hermes Shoes activated by: <b>{state.hermes.lastUsedBy}</b>
        </div>
      )}
    </div>
  );
}

export default function AdminPreRoundOnePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [state, setState] = useState(null);
  const [teams, setTeams] = useState([]);
  const esRef = useRef(null);

  const fetchState = async () => {
    const res = await fetch("/api/game/state");
    const j = await res.json();
    if (j?.ok) {
      setState(j.state);
      setTeams(j.teams || []);
    }
  };

  useEffect(() => {
    const role = localStorage.getItem("role");
    const user = localStorage.getItem("name");
    if (!role || !user) {
      router.replace("/login");
      return;
    }
    if (role !== "admin") {
      router.replace("/pre-round-one");
      return;
    }
    setName(user);
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
        if (data?.type === "hermes:used") {
          setState((s) => ({
            ...s,
            hermes: { ...s?.hermes, lastUsedBy: data.payload.username },
          }));
          fetchState();
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

  if (!ready) return null;

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Admin • Pre Round One</h1>
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
            Go Pre-R1
          </button>
          <button
            onClick={() => setRound("round-one")}
            className="rounded border px-3 py-1"
          >
            Go Round 1
          </button>
          <button
            onClick={() => setRound("round-two")}
            className="rounded border px-3 py-1"
          >
            Go Round 2
          </button>
        </div>

        <AdminGlobalControls state={state} teams={teams} refresh={fetchState} />
      </div>
    </div>
  );
}
