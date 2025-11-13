import { NextResponse } from "next/server";
import { setQuestionVisible } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { visible } = await request.json();
    const state = setQuestionVisible(!!visible);
    return NextResponse.json({ ok: true, state });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to set question visibility" },
      { status: 500 }
    );
  }
}
