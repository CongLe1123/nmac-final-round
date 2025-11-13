import { NextResponse } from "next/server";
import {
  getGameState,
  getTeams,
  TOPICS,
  getAvailableTopics,
} from "@/lib/state";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = getGameState();
    const teams = getTeams();
    const availableTopics = getAvailableTopics();
    return NextResponse.json({
      ok: true,
      state,
      teams,
      topics: TOPICS,
      availableTopics,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to load state" },
      { status: 500 }
    );
  }
}
