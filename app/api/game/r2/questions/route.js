import { NextResponse } from "next/server";
import { r2ListQuestions } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const topic = searchParams.get("topic");
    const questions = r2ListQuestions(topic || null);
    return NextResponse.json({ ok: true, questions });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to load questions" },
      { status: 500 }
    );
  }
}
