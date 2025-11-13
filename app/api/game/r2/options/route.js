import { NextResponse } from "next/server";
import { r2SetOptions, r2ListOptions } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { options, visible } = await request.json();
    const result = r2SetOptions(options, visible);
    if (result?.ok === false) return NextResponse.json(result, { status: 400 });
    return NextResponse.json({ ok: true, state: result.state });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to update options" },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get("questionId");
    if (!questionId) {
      return NextResponse.json(
        { ok: false, error: "Missing questionId" },
        { status: 400 }
      );
    }
    const options = r2ListOptions(questionId);
    return NextResponse.json({ ok: true, options });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to load options" },
      { status: 500 }
    );
  }
}
