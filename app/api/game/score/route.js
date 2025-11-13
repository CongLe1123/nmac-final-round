import { NextResponse } from "next/server";
import { adjustScore } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { username, delta } = await request.json();
    const teams = adjustScore(username, Number(delta) || 0);
    return NextResponse.json({ ok: true, teams });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to update score" },
      { status: 500 }
    );
  }
}
