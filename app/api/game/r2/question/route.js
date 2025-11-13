import { NextResponse } from "next/server";
import { r2SelectQuestion, r2SetQuestionVisible } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    if (Object.prototype.hasOwnProperty.call(body, "id")) {
      const result = r2SelectQuestion(body.id || null);
      if (result?.ok === false)
        return NextResponse.json(result, { status: 400 });
      return NextResponse.json({ ok: true, state: result.state });
    }
    if (Object.prototype.hasOwnProperty.call(body, "visible")) {
      const result = r2SetQuestionVisible(!!body.visible);
      return NextResponse.json({ ok: true, state: result.state });
    }
    return NextResponse.json(
      { ok: false, error: "Missing id or visible" },
      { status: 400 }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to update question" },
      { status: 500 }
    );
  }
}
