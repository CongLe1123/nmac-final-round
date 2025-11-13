import { NextResponse } from "next/server";
import { getCurrentRound, setCurrentRound, VALID_ROUNDS } from "@/lib/round";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const round = getCurrentRound();
    return NextResponse.json({ ok: true, round });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to get round" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { round } = await request.json();
    if (!VALID_ROUNDS.includes(round)) {
      return NextResponse.json(
        { ok: false, error: "Invalid round" },
        { status: 400 }
      );
    }
    const updated = setCurrentRound(round);
    return NextResponse.json({ ok: true, round: updated });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to set round" },
      { status: 500 }
    );
  }
}
