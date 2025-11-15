import { NextResponse } from "next/server";
import { r2PlaceBet, r2PlaceBetById } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { username, userId, amount } = await request.json();
    const result =
      userId != null
        ? r2PlaceBetById(userId, amount)
        : r2PlaceBet(username, amount);
    if (result?.ok === false) return NextResponse.json(result, { status: 400 });
    return NextResponse.json({ ok: true, state: result.state });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to place bet" },
      { status: 500 }
    );
  }
}
