"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [tableInfo, setTableInfo] = useState(null);
  const [rows, setRows] = useState([]);
  const [formMode, setFormMode] = useState("create"); // create | update
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const role = localStorage.getItem("role");
    const user = localStorage.getItem("name");

    if (!role || !user) {
      router.replace("/login");
      return;
    }

    if (role !== "admin") {
      router.replace("/login");
      return;
    }

    setName(user);
    setReady(true);
    // Load DB tables
    fetch("/api/admin/sql/tables")
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) {
          setTables(j.tables || []);
          if ((j.tables || []).length) {
            const first = j.tables[0];
            setSelectedTable(first.name);
          }
        }
      })
      .catch(() => {});
  }, [router]);

  const logout = () => {
    localStorage.removeItem("role");
    localStorage.removeItem("name");
    router.replace("/login");
  };
  useEffect(() => {
    if (!selectedTable) return;
    // load table info and rows
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/sql/info?table=${encodeURIComponent(selectedTable)}`)
        .then((r) => r.json())
        .catch(() => ({})),
      fetch(`/api/admin/sql/select?table=${encodeURIComponent(selectedTable)}`)
        .then((r) => r.json())
        .catch(() => ({})),
    ])
      .then(([i, s]) => {
        if (i?.ok) setTableInfo(i.info);
        if (s?.ok) setRows(s.rows || []);
        setFormMode("create");
        setFormData({});
      })
      .finally(() => setLoading(false));
  }, [selectedTable]);

  if (!ready) return null;

  return (
    <div className="min-h-screen flex items-start justify-center p-6">
      <div className="max-w-6xl w-full">
        <h1 className="text-2xl font-semibold mb-2">Database Editor</h1>
        <p className="mb-4 text-zinc-600">
          View and edit tables with human-friendly field names.
        </p>

        <div className="mb-4 flex flex-wrap gap-2 items-center">
          <label className="text-sm">Table</label>
          <select
            className="rounded border px-2 py-1"
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
          >
            {tables.map((t) => (
              <option key={t.name} value={t.name}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setSelectedTable((v) => v)}
            className="rounded border px-3 py-1"
          >
            Refresh
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">{tableInfo?.label || "Table"}</div>
                {loading && (
                  <div className="text-xs text-zinc-500">Loading...</div>
                )}
              </div>
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      {tableInfo?.columns?.map((c) => (
                        <th key={c.name} className="text-left p-2 border-b">
                          {c.label}
                        </th>
                      ))}
                      <th className="p-2 border-b">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        {tableInfo?.columns?.map((c) => (
                          <td key={c.name} className="p-2 align-top">
                            {String(r[c.name] ?? "")}
                          </td>
                        ))}
                        <td className="p-2">
                          <div className="flex gap-2">
                            <button
                              className="rounded border px-2 py-1"
                              onClick={() => {
                                setFormMode("update");
                                setFormData(r);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="rounded border px-2 py-1 text-red-600"
                              onClick={async () => {
                                if (!tableInfo?.pk) return;
                                const pk = r[tableInfo.pk];
                                if (!window.confirm("Delete this row?")) return;
                                await fetch("/api/admin/sql/delete", {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    table: selectedTable,
                                    pk,
                                  }),
                                });
                                const res = await fetch(
                                  `/api/admin/sql/select?table=${encodeURIComponent(
                                    selectedTable
                                  )}`
                                );
                                const j = await res.json();
                                if (j?.ok) setRows(j.rows || []);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td
                          className="p-3 text-zinc-600"
                          colSpan={(tableInfo?.columns?.length || 0) + 1}
                        >
                          No rows.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div>
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">
                  {formMode === "create" ? "Add New" : "Edit Row"}
                </div>
                <button
                  className="text-sm underline"
                  onClick={() => {
                    setFormMode("create");
                    setFormData({});
                  }}
                >
                  New
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {tableInfo?.columns?.map((c) => (
                  <div key={c.name} className="space-y-1">
                    <label className="text-sm block">{c.label}</label>
                    <input
                      className="w-full rounded border px-2 py-1"
                      type="text"
                      value={formData[c.name] ?? ""}
                      onChange={(e) =>
                        setFormData((d) => ({ ...d, [c.name]: e.target.value }))
                      }
                      disabled={
                        formMode === "update" &&
                        c.pk &&
                        tableInfo?.autoincrement
                      }
                      placeholder={c.name}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  className="rounded bg-black text-white px-3 py-1"
                  onClick={async () => {
                    const mode = formMode;
                    const body = { table: selectedTable, data: formData, mode };
                    await fetch("/api/admin/sql/upsert", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(body),
                    });
                    const res = await fetch(
                      `/api/admin/sql/select?table=${encodeURIComponent(
                        selectedTable
                      )}`
                    );
                    const j = await res.json();
                    if (j?.ok) setRows(j.rows || []);
                    if (mode === "create") setFormData({});
                  }}
                >
                  Save
                </button>
                <button
                  className="rounded border px-3 py-1"
                  onClick={() => {
                    setFormMode("create");
                    setFormData({});
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => router.push("/change-password")}
            className="rounded-md border border-zinc-300 px-4 py-2 text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Change password
          </button>
          <button
            onClick={logout}
            className="rounded-md bg-black px-4 py-2 text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
