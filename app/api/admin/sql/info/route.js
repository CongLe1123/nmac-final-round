import { NextResponse } from "next/server";
import { getTableInfo, assertAllowed } from "../_meta";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table");
    if (!table)
      return NextResponse.json(
        { ok: false, error: "Missing table" },
        { status: 400 }
      );
    assertAllowed(table);
    const info = getTableInfo(table);
    return NextResponse.json({ ok: true, info });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to load table info" },
      { status: 500 }
    );
  }
}
