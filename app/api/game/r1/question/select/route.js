import { NextResponse } from "next/server";
import { setCurrentQuestion } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { id } = await request.json();
    const result = setCurrentQuestion(id || null);
    if (result?.ok === false) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json({ ok: true, state: result.state });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to select question" },
      { status: 500 }
    );
  }
}
