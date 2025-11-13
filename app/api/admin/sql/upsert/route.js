import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getTableInfo, assertAllowed } from "../_meta";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { table, data, mode } = await request.json(); // mode: 'create' | 'update'
    if (!table || !data || !mode)
      return NextResponse.json(
        { ok: false, error: "Missing params" },
        { status: 400 }
      );
    assertAllowed(table);
    const info = getTableInfo(table);
    const columns = info.columns.map((c) => c.name);

    if (mode === "create") {
      const payload = { ...data };
      // For autoincrement PK, drop provided id to let DB assign
      if (info.autoincrement && info.pk && info.pk in payload)
        delete payload[info.pk];
      const keys = Object.keys(payload).filter((k) => columns.includes(k));
      const placeholders = keys.map(() => "?").join(",");
      const sql = `INSERT INTO ${table} (${keys.join(
        ","
      )}) VALUES (${placeholders})`;
      const stmt = db.prepare(sql);
      const res = stmt.run(...keys.map((k) => payload[k]));
      return NextResponse.json({
        ok: true,
        lastInsertRowid: res.lastInsertRowid,
      });
    } else if (mode === "update") {
      if (!info.pk)
        return NextResponse.json(
          { ok: false, error: "No primary key" },
          { status: 400 }
        );
      const pkValue = data[info.pk];
      if (pkValue === undefined || pkValue === null)
        return NextResponse.json(
          { ok: false, error: "Missing primary key in data" },
          { status: 400 }
        );
      const payload = { ...data };
      // Do not allow changing PK value
      delete payload[info.pk];
      const keys = Object.keys(payload).filter((k) => columns.includes(k));
      const sets = keys.map((k) => `${k} = ?`).join(", ");
      const sql = `UPDATE ${table} SET ${sets} WHERE ${info.pk} = ?`;
      const stmt = db.prepare(sql);
      const res = stmt.run(...keys.map((k) => payload[k]), pkValue);
      return NextResponse.json({ ok: true, changes: res.changes });
    }

    return NextResponse.json(
      { ok: false, error: "Invalid mode" },
      { status: 400 }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Failed to upsert" },
      { status: 500 }
    );
  }
}
