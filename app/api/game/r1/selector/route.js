import { NextResponse } from "next/server";
import { setCurrentSelector, setCurrentSelectorById } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { username, userId } = await request.json();
    const state =
      userId != null
        ? setCurrentSelectorById(Number(userId) || null)
        : setCurrentSelector(username || null);
    return NextResponse.json({ ok: true, state });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to set selector" },
      { status: 500 }
    );
  }
}
