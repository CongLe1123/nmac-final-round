import { NextResponse } from "next/server";
import { useHermes, useHermesById } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { username, userId } = await request.json();
    const result = userId != null ? useHermesById(userId) : useHermes(username);
    if (result?.ok === false) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      state: result.state,
      teams: result.teams,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to use Hermes Shoes" },
      { status: 500 }
    );
  }
}
