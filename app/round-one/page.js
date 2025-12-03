"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function RoundOnePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [userId, setUserId] = useState(null);
  const [state, setState] = useState(null);
  const [teams, setTeams] = useState([]);
  const [r1Topics, setR1Topics] = useState([]);
  const [busy, setBusy] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionId, setCurrentQuestionId] = useState(null);
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
        if (path !== "/round-one") router.replace(path);
      })
      .catch(() => {});

    // Subscribe for live round changes
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
        if (path !== "/round-one") router.replace(path);
      } catch {}
    };
    es.onerror = () => {};

    // Subscribe to game events
    const esGame = new EventSource("/api/game/stream");
    esRef.current = esGame;
    esGame.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data?.type === "init") setState(data.payload);
        if (data?.type === "r1:selector")
          setState((s) => ({
            ...s,
            roundOne: {
              ...s?.roundOne,
              currentSelector: data.payload.currentSelector,
            },
          }));
        if (data?.type === "r1:topic:selected")
          setState((s) => ({
            ...s,
            roundOne: {
              ...s?.roundOne,
              selectedTopics: data.payload.selectedTopics,
              currentSelector: null,
              currentQuestionTopicId: data.payload.topicId,
            },
          }));
        if (data?.type === "r1:question")
          setState((s) => ({
            ...s,
            roundOne: { ...s?.roundOne, questionVisible: data.payload.visible },
          }));
        if (data?.type === "r1:question:selected")
          setCurrentQuestionId(data?.payload?.id || null);
        if (data?.type === "r1:options")
          setState((s) => ({
            ...s,
            roundOne: {
              ...s?.roundOne,
              options: Array.isArray(data.payload?.options)
                ? data.payload.options
                : [],
            },
          }));
        if (data?.type?.startsWith("buzz:"))
          setState((s) => ({ ...s, buzz: { ...s?.buzz, ...data.payload } }));
        if (data?.type === "hermes:used")
          setState((s) => ({
            ...s,
            hermes: { ...s?.hermes, lastUsedById: data.payload.userId },
          }));
        if (data?.type === "hermes:cleared")
          setState((s) => ({
            ...s,
            hermes: { ...s?.hermes, lastUsedById: null },
          }));
      } catch {}
    };

    // Initial fetch of game state
    fetch("/api/game/state")
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) {
          setState(j.state);
          setTeams(j.teams || []);
          setR1Topics(j.r1Topics || []);
        }
      })
      .catch(() => {});

    // Fetch questions once for mapping selected id -> text
    fetch("/api/game/r1/questions")
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) {
          setQuestions(j.questions || []);
          setCurrentQuestionId(j.currentQuestionId || null);
        }
      })
      .catch(() => {});

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

  const doSelectTopic = async (topicId) => {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/game/r1/select-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, topicId }),
      });
    } finally {
      setBusy(false);
    }
  };

  const doBuzz = async () => {
    await fetch("/api/game/buzz/in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
  };

  const useHermes = async () => {
    await fetch("/api/game/hermes/use", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen flex items-start justify-center p-6">
      <div className="max-w-3xl w-full">
        <h1 className="text-2xl font-semibold mb-2">Welcome, {name}</h1>
        <p className="mb-4 text-zinc-600">This is Round One.</p>

        {state?.hermes?.lastUsedById && (
          <div className="mb-3 rounded-md border border-amber-400 bg-amber-50 p-3 text-amber-900">
            Hermes Shoes activated by:{" "}
            <b>
              {teams.find((t) => t.id === state.hermes.lastUsedById)
                ?.username || state.hermes.lastUsedById}
            </b>
          </div>
        )}

        {state?.roundOne?.questionVisible && (
          <div className="mb-4 rounded-md border border-indigo-400 bg-indigo-50 p-3 text-indigo-900">
            {(() => {
              const q = questions.find((x) => x.id === currentQuestionId);
              return q ? (
                <>
                  <div className="text-sm uppercase tracking-wide text-indigo-700">
                    {q.topic}
                  </div>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {q.text}
                  </ReactMarkdown>
                  {(state?.roundOne?.options || []).length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {(state?.roundOne?.options || []).map((opt, idx) => {
                        const label = String.fromCharCode(65 + idx);
                        return (
                          <div
                            key={`${
                              state?.roundOne?.currentQuestionId || ""
                            }-${idx}`}
                            className="flex items-start gap-2 rounded border border-indigo-200 bg-white/80 px-3 py-2 text-indigo-900"
                          >
                            <span className="font-semibold text-indigo-700">
                              {label}.
                            </span>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              // className="flex-1"
                            >
                              {opt}
                            </ReactMarkdown>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-indigo-700 opacity-80">
                      Không có đáp án trắc nghiệm cho câu hỏi này.
                    </div>
                  )}
                </>
              ) : (
                "Câu hỏi đang hiển thị"
              );
            })()}
          </div>
        )}

        {state?.roundOne?.currentSelector === userId ? (
          <div className="mb-6 rounded-md border p-4">
            <div className="font-medium mb-2">Chọn chủ đề</div>
            <div className="grid grid-cols-2 gap-2">
              {(r1Topics || []).map((t) => {
                const topicName = t.name;
                const taken = Object.values(
                  state?.roundOne?.selectedTopics || {}
                )
                  .map((x) => Number(x))
                  .includes(Number(t.id));
                return (
                  <button
                    key={t.id}
                    disabled={taken || busy}
                    onClick={() => doSelectTopic(t.id)}
                    className={`rounded border px-3 py-2 text-left ${
                      taken ? "opacity-50" : "hover:bg-zinc-50"
                    }`}
                  >
                    {topicName}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mb-6 text-sm text-zinc-600">
            {state?.roundOne?.currentSelector
              ? `${
                  teams.find((t) => t.id === state.roundOne.currentSelector)
                    ?.username || state.roundOne.currentSelector
                } đang chọn chủ đề...`
              : "Chờ quản trị viên"}
          </div>
        )}

        <div className="mb-6 flex gap-3 items-center">
          <button
            onClick={useHermes}
            className="rounded bg-amber-600 text-white px-4 py-2 hover:bg-amber-700"
          >
            Dùng Hermes Shoes
          </button>
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
            {(() => {
              const winnerId = state?.buzz?.winner;
              const winnerName = teams.find((t) => t.id === winnerId)?.username;
              if (winnerId) return `Đội buzz trước: ${winnerName || winnerId}`;
              return state?.buzz?.allowed ? "Buzz đang mở" : "Buzz đang tắt";
            })()}
          </div>
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
