import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getTableInfo, assertAllowed } from "../_meta";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { table, pk } = await request.json();
    if (!table)
      return NextResponse.json(
        { ok: false, error: "Missing table" },
        { status: 400 }
      );
    assertAllowed(table);
    const info = getTableInfo(table);
    if (!info.pk)
      return NextResponse.json(
        { ok: false, error: "No primary key" },
        { status: 400 }
      );
    if (pk === undefined || pk === null)
      return NextResponse.json(
        { ok: false, error: "Missing primary key value" },
        { status: 400 }
      );
    const res = db.prepare(`DELETE FROM ${table} WHERE ${info.pk} = ?`).run(pk);
    return NextResponse.json({ ok: true, changes: res.changes });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to delete" },
      { status: 500 }
    );
  }
}
