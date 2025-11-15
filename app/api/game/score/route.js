import { NextResponse } from "next/server";
import { adjustScore, adjustScoreById } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { username, userId, delta } = await request.json();
    const d = Number(delta) || 0;
    const teams =
      userId != null ? adjustScoreById(userId, d) : adjustScore(username, d);
    return NextResponse.json({ ok: true, teams });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to update score" },
      { status: 500 }
    );
  }
}
