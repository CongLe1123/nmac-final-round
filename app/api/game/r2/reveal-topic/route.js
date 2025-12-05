import { NextResponse } from "next/server";
import { r2RevealTopic } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = r2RevealTopic();
    if (result?.ok === false) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json({ ok: true, state: result.state });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to reveal topic" },
      { status: 500 }
    );
  }
}
