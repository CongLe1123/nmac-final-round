import { NextResponse } from "next/server";
import { getTableSummary } from "../_meta";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const list = getTableSummary();
    return NextResponse.json({ ok: true, tables: list });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to load tables" },
      { status: 500 }
    );
  }
}
