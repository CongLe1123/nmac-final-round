import { NextResponse } from "next/server";
import { r2SetMaxBet } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { maxBet } = await request.json();
    const result = r2SetMaxBet(maxBet);
    if (result?.ok === false) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json({ ok: true, state: result.state });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to set max bet" },
      { status: 500 }
    );
  }
}
