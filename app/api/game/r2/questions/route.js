import { NextResponse } from "next/server";
import { r2ListQuestionsByTopicId } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const topicId = Number(searchParams.get("topicId")) || null;
    const questions = r2ListQuestionsByTopicId(topicId);
    return NextResponse.json({ ok: true, questions });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to load questions" },
      { status: 500 }
    );
  }
}
