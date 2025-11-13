import { NextResponse } from "next/server";
import { r2Settle } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = r2Settle();
    if (result?.ok === false) return NextResponse.json(result, { status: 400 });
    return NextResponse.json({
      ok: true,
      state: result.state,
      teams: result.teams,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to settle scores" },
      { status: 500 }
    );
  }
}
