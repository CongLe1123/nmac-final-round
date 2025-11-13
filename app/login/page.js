"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // If already logged in, forward accordingly
  useEffect(() => {
    const role =
      typeof window !== "undefined" ? localStorage.getItem("role") : null;
    const name =
      typeof window !== "undefined" ? localStorage.getItem("name") : null;
    if (role && name) {
      if (role === "admin") router.replace("/admin");
      else router.replace("/round-one");
    }
  }, [router]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Invalid username or password.");
        return;
      }

      localStorage.setItem("name", data.username);
      localStorage.setItem("role", data.role);

      if (data.role === "admin") router.replace("/admin");
      else router.replace("/round-one");
    } catch (err) {
      setError("Unable to sign in. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h1 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Login
        </h1>

        <label className="mb-2 block text-sm text-zinc-700 dark:text-zinc-300">
          Username
        </label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="team1 | team2 | team3 | team4 | admin"
          className="mb-4 w-full rounded-md border border-zinc-300 bg-white p-2 text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          autoComplete="username"
        />

        <label className="mb-2 block text-sm text-zinc-700 dark:text-zinc-300">
          Password
        </label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="123456789Aa"
          className="mb-4 w-full rounded-md border border-zinc-300 bg-white p-2 text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          autoComplete="current-password"
        />

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          className="w-full rounded-md bg-black px-4 py-2 text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
