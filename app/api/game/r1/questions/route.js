import { NextResponse } from "next/server";
import { getGameState, listQuestions } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = getGameState();
    const questions = listQuestions();
    return NextResponse.json({
      ok: true,
      questions,
      currentQuestionId: state?.roundOne?.currentQuestionId || null,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to load questions" },
      { status: 500 }
    );
  }
}
