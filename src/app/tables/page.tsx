"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Table } from "@/lib/types";

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("tables")
        .select("id, name, seats, is_occupied")
        .order("name", { ascending: true });
      if (error) {
        setError(error.message);
      } else {
        setTables((data as unknown as Table[]) || []);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-6">加载中...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">选择餐桌与人数</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {tables.map((t) => (
          <div
            key={t.id}
            className={`border rounded p-4 flex flex-col gap-2 ${
              t.is_occupied ? "opacity-60" : ""
            }`}
          >
            <div className="font-medium">{t.name}</div>
            <div className="text-sm text-gray-500">可坐 {t.seats} 人</div>
            <Link
              href={`/tables/${t.id}`}
              className="mt-2 inline-block rounded bg-black text-white px-3 py-1 text-sm disabled:opacity-50"
            >
              选择
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}


