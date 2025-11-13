"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function RoundOnePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");

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

    // Ensure we're on the correct round page on mount
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
        if (path !== "/pre-round-one") router.replace(path);
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
        if (path !== "/pre-round-one") router.replace(path);
      } catch {}
    };
    es.onerror = () => {
      // browser will auto-retry
    };

    return () => {
      es.close();
    };
  }, [router]);

  const logout = () => {
    localStorage.removeItem("role");
    localStorage.removeItem("name");
    router.replace("/login");
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen flex items-start justify-center p-6">
      <div className="max-w-2xl w-full">
        <h1 className="text-2xl font-semibold mb-4">Hello, {name}</h1>
        <p className="mb-6 text-zinc-600">Welcome.</p>
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
