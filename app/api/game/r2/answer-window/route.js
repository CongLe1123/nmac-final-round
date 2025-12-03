import { NextResponse } from "next/server";
import { r2SetAnswerWindow } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { visible } = await request.json();
    const result = r2SetAnswerWindow(visible);
    if (result?.ok === false) return NextResponse.json(result, { status: 400 });
    return NextResponse.json({ ok: true, state: result.state });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to update answer window" },
      { status: 500 }
    );
  }
}
