import { NextResponse } from "next/server";
import { selectTopic } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { username, topic } = await request.json();
    const result = selectTopic(username, topic);
    if (result?.ok === false) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json({ ok: true, state: result.state });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to select topic" },
      { status: 500 }
    );
  }
}
