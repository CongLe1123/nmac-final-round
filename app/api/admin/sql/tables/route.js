import { NextResponse } from "next/server";
import { TABLES, getTableInfo } from "../_meta";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const list = Object.keys(TABLES).map((t) => getTableInfo(t));
    return NextResponse.json({ ok: true, tables: list });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to load tables" },
      { status: 500 }
    );
  }
}
