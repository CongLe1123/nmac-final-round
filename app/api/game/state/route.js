import { NextResponse } from "next/server";
import {
  getGameState,
  getTeams,
  getR1TopicList,
  getR2TopicList,
  getAvailableTopicIds,
} from "@/lib/state";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = getGameState();
    const teams = getTeams();
    const r1Topics = getR1TopicList();
    const r2Topics = getR2TopicList();
    const r1AvailableTopicIds = getAvailableTopicIds();
    return NextResponse.json({
      ok: true,
      state,
      teams,
      r1Topics,
      r2Topics,
      r1AvailableTopicIds,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to load state" },
      { status: 500 }
    );
  }
}
