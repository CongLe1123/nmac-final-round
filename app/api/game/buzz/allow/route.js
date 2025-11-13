import { NextResponse } from "next/server";
import { setBuzzAllowed } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { allowed } = await request.json();
    const state = setBuzzAllowed(!!allowed);
    return NextResponse.json({ ok: true, state });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to update buzz state" },
      { status: 500 }
    );
  }
}
