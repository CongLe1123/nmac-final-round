import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, error: "Missing username or password" },
        { status: 400 }
      );
    }

    const stmt = db.prepare(
      "SELECT id, username, role FROM users WHERE LOWER(username) = LOWER(?) AND password = ?"
    );
    const row = stmt.get(username, password);

    if (!row) {
      return NextResponse.json(
        { ok: false, error: "Invalid username or password" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      ok: true,
      id: row.id,
      username: row.username,
      role: row.role,
    });
  } catch (err) {
    console.error("/api/login error", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
