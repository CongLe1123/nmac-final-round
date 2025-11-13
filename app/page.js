"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const role = localStorage.getItem("role");
    const name = localStorage.getItem("name");

    if (!role || !name) {
      router.replace("/login");
      return;
    }

    if (role === "admin") router.replace("/admin");
    else {
      // Fetch current round and redirect accordingly
      fetch("/api/round")
        .then((r) => r.json())
        .then((j) => {
          const round = j?.round || "pre-round-one";
          const path =
            round === "pre-round-one"
              ? "/pre-round-one"
              : round === "round-two"
              ? "/round-two"
              : "/round-one";
          router.replace(path);
        })
        .catch(() => router.replace("/pre-round-one"));
    }
  }, [router]);

  // Empty shell while redirecting
  return null;
}
