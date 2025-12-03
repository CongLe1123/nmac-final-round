import { resetGameState } from "@/lib/state";

export async function POST(req) {
  try {
    const state = resetGameState();

    return new Response(JSON.stringify({ ok: true, state }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: "Failed to reset game state." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
