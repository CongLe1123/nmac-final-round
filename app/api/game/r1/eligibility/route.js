import { NextResponse } from "next/server";
import { setEligibleSelectors } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { eligible } = await request.json();
    const state = setEligibleSelectors(Array.isArray(eligible) ? eligible : []);
    return NextResponse.json({ ok: true, state });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to set eligibility" },
      { status: 500 }
    );
  }
}
