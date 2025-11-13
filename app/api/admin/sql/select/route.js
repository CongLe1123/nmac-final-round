import { NextResponse } from "next/server";
import db from "@/lib/db";
import { assertAllowed } from "../_meta";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table");
    const limit = Number(searchParams.get("limit") || 200);
    if (!table)
      return NextResponse.json(
        { ok: false, error: "Missing table" },
        { status: 400 }
      );
    assertAllowed(table);
    const rows = db.prepare(`SELECT * FROM ${table} LIMIT ?`).all(limit);
    return NextResponse.json({ ok: true, rows });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to select" },
      { status: 500 }
    );
  }
}
