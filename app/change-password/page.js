"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const role = localStorage.getItem("role");
    const name = localStorage.getItem("name");
    if (!role || !name) {
      router.replace("/login");
      return;
    }
    setUsername(name);
    setReady(true);
  }, [router]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    try {
      const res = await fetch("/api/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Unable to change password");
        return;
      }

      setSuccess("Password updated. Please sign in again.");

      // Clear client auth state and redirect to login
      localStorage.removeItem("role");
      localStorage.removeItem("name");
      setTimeout(() => router.replace("/login"), 800);
    } catch (err) {
      setError("Server error. Please try again.");
    }
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h1 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Change Password
        </h1>

        <label className="mb-2 block text-sm text-zinc-700 dark:text-zinc-300">
          Username
        </label>
        <input
          value={username}
          disabled
          className="mb-4 w-full rounded-md border border-zinc-300 bg-zinc-100 p-2 text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />

        <label className="mb-2 block text-sm text-zinc-700 dark:text-zinc-300">
          Current Password
        </label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          className="mb-4 w-full rounded-md border border-zinc-300 bg-white p-2 text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />

        <label className="mb-2 block text-sm text-zinc-700 dark:text-zinc-300">
          New Password
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          className="mb-2 w-full rounded-md border border-zinc-300 bg-white p-2 text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />

        <label className="mb-2 block text-sm text-zinc-700 dark:text-zinc-300">
          Confirm New Password
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          className="mb-4 w-full rounded-md border border-zinc-300 bg-white p-2 text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {success && <p className="mb-3 text-sm text-green-600">{success}</p>}

        <button
          type="submit"
          className="w-full rounded-md bg-black px-4 py-2 text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Update Password
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          className="mt-3 w-full rounded-md border border-zinc-300 px-4 py-2 text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </form>
    </div>
  );
}
