import { NextResponse } from "next/server";
import { r2RevealCorrectAnswer } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    // Auto-reveal from DB; ignore any provided input
    let body = null;
    try {
      body = await request.json();
    } catch {}
    const result = r2RevealCorrectAnswer();
    if (result?.ok === false) return NextResponse.json(result, { status: 400 });
    return NextResponse.json({
      ok: true,
      state: result.state,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to reveal answer" },
      { status: 500 }
    );
  }
}
