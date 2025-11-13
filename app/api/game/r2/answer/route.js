import { NextResponse } from "next/server";
import { r2SubmitAnswer } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { username, answer } = await request.json();
    const result = r2SubmitAnswer(username, answer);
    if (result?.ok === false) return NextResponse.json(result, { status: 400 });
    return NextResponse.json({ ok: true, state: result.state });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to submit answer" },
      { status: 500 }
    );
  }
}
