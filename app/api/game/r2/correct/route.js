import { NextResponse } from "next/server";
import { r2SetManualCorrectUsers } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { userIds } = await request.json();
    const result = r2SetManualCorrectUsers(userIds);
    return NextResponse.json({ ok: true, state: result.state });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to update manual correct answers" },
      { status: 500 }
    );
  }
}
