import { NextResponse } from "next/server";
import db from "@/lib/db";

// POST /api/change-password
// body: { username: string, currentPassword: string, newPassword: string }
export async function POST(request) {
  try {
    const { username, currentPassword, newPassword } = await request.json();

    if (!username || !currentPassword || !newPassword) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Basic password policy (optional, adjust as needed)
    if (newPassword.length < 8) {
      return NextResponse.json(
        { ok: false, error: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Verify current credentials
    const getStmt = db.prepare(
      "SELECT id, username FROM users WHERE LOWER(username) = LOWER(?) AND password = ?"
    );
    const user = getStmt.get(username, currentPassword);

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    // Update password
    const updateStmt = db.prepare("UPDATE users SET password = ? WHERE id = ?");
    updateStmt.run(newPassword, user.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("/api/change-password error", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
