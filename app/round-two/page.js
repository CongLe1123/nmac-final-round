"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function RoundTwoPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [state, setState] = useState(null);
  const [teams, setTeams] = useState([]);
  const [bet, setBet] = useState("");
  const esRef = useRef(null);

  useEffect(() => {
    const role = localStorage.getItem("role");
    const user = localStorage.getItem("name");

    if (!role || !user) {
      router.replace("/login");
      return;
    }

    if (role === "admin") {
      router.replace("/admin");
      return;
    }

    setName(user);
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
              }
            })
            .catch(() => {});
        }
        if (data?.type?.startsWith("buzz:"))
          setState((s) => ({ ...s, buzz: { ...s?.buzz, ...data.payload } }));
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

  const logout = () => {
    localStorage.removeItem("role");
    localStorage.removeItem("name");
    router.replace("/login");
  };

  const doBuzz = async () => {
    await fetch("/api/game/buzz/in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: name }),
    });
  };

  const placeBet = async () => {
    await fetch("/api/game/r2/bet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: name, amount: Number(bet) || 0 }),
    });
  };

  const submitAnswer = async (answer) => {
    await fetch("/api/game/r2/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: name, answer }),
    });
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen flex items-start justify-center p-6">
      <div className="max-w-2xl w-full">
        <h1 className="text-2xl font-semibold mb-4">Welcome, {name}</h1>
        <p className="mb-4 text-zinc-600">This is Round Two.</p>

        <div className="mb-6 flex gap-3 items-center">
          <button
            onClick={doBuzz}
            disabled={!state?.buzz?.allowed || !!state?.buzz?.winner}
            className={`rounded px-4 py-2 ${
              state?.buzz?.allowed && !state?.buzz?.winner
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-zinc-200 text-zinc-600"
            }`}
          >
            Buzz!
          </button>
          <div className="text-sm text-zinc-600">
            {state?.buzz?.winner
              ? `Đội buzz trước: ${state.buzz.winner}`
              : state?.buzz?.allowed
              ? "Buzz đang mở"
              : "Buzz đang tắt"}
          </div>
        </div>

        {/* Round Two flow */}
        <div className="rounded-md border p-4 space-y-4 mb-6">
          <div className="text-lg font-medium">Round 2</div>
          <div className="text-sm text-zinc-600">
            Topic: {state?.roundTwo?.topic ?? "(waiting for admin)"}
          </div>
          <div className="text-sm text-zinc-600">
            Max bet: {state?.roundTwo?.maxBet || 0}
          </div>
          <div className="text-sm text-zinc-600">
            Your score: {teams.find((t) => t.username === name)?.score ?? 0}
          </div>

          {(state?.roundTwo?.stage === "betting" ||
            state?.roundTwo?.stage === "question") && (
            <div className="flex items-center gap-2 flex-wrap">
              {(() => {
                const teamScore =
                  teams.find((t) => t.username === name)?.score ?? 0;
                const limit =
                  state?.roundTwo?.maxBet > 0
                    ? state.roundTwo.maxBet
                    : Number.MAX_SAFE_INTEGER;
                const maxAllowed = Math.min(limit, Number(teamScore));
                const currentBet = Number(state?.roundTwo?.bets?.[name] ?? 0);
                let buttons = [];
                for (let v = 10; v <= maxAllowed; v += 10) buttons.push(v);
                if (state?.roundTwo?.stage === "question") {
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
                        body: JSON.stringify({ username: name, amount: v }),
                      });
                    }}
                    className={`rounded border px-3 py-1 ${
                      (state?.roundTwo?.bets?.[name] ?? 0) === v
                        ? "bg-zinc-900 text-white"
                        : ""
                    }`}
                  >
                    {v}
                  </button>
                ));
              })()}
              <div className="text-sm text-zinc-600 ml-2">
                Current bet: {state?.roundTwo?.bets?.[name] ?? 0}
              </div>
            </div>
          )}

          {state?.roundTwo?.questionVisible && (
            <div className="rounded border p-3">
              <div className="font-medium">Question</div>
              <div className="text-sm text-zinc-900">
                {state?.roundTwo?.currentQuestionText || "(no text)"}
              </div>
              <div className="text-xs text-zinc-500">
                ID: {state?.roundTwo?.currentQuestionId || "(none)"}
              </div>
              <div className="text-xs text-zinc-500">
                You may increase your bet, not decrease.
              </div>
            </div>
          )}

          {state?.roundTwo?.optionsVisible && (
            <div className="rounded border p-3 space-y-2">
              <div className="font-medium">Options</div>
              <div className="flex flex-wrap gap-2">
                {(state?.roundTwo?.options || []).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => submitAnswer(opt)}
                    className={`rounded border px-3 py-1 ${
                      state?.roundTwo?.answers?.[name] === opt
                        ? "bg-zinc-900 text-white"
                        : ""
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <div className="text-sm text-zinc-600">
                Your answer: {state?.roundTwo?.answers?.[name] ?? "(none)"}
              </div>
              {state?.roundTwo?.correctAnswer && (
                <div className="text-sm text-emerald-700">
                  Correct answer: {state.roundTwo.correctAnswer}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-3">
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
        </div>
      </div>
    </div>
  );
}
