import { NextResponse } from "next/server";
import { buzzIn } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { username } = await request.json();
    const result = buzzIn(username);
    if (result?.ok === false) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json({ ok: true, state: result.state });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to buzz in" },
      { status: 500 }
    );
  }
}
