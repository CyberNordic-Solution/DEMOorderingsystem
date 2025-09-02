"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function TablePeoplePage({ params }: { params: { tableId: string } }) {
  const router = useRouter();
  const [people, setPeople] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onConfirm = async () => {
    try {
      setBusy(true);
      setError(null);
      // create or reuse open order for this table
      const { data: existing, error: e1 } = await supabase
        .from("orders")
        .select("id, status")
        .eq("table_id", params.tableId)
        .eq("status", "open")
        .maybeSingle();
      if (e1) throw e1;

      let orderId = existing?.id as string | undefined;
      if (!orderId) {
        const { data, error: e2 } = await supabase
          .from("orders")
          .insert({ table_id: params.tableId, people_count: people, status: "open" })
          .select("id")
          .single();
        if (e2) throw e2;
        orderId = data!.id as string;
      } else {
        await supabase.from("orders").update({ people_count: people }).eq("id", orderId);
      }

      router.push(`/orders/${orderId}`);
    } catch (err: any) {
      setError(err?.message ?? "发生错误");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">选择人数</h1>
      <div className="flex items-center gap-3">
        <button
          className="border rounded px-3 py-1"
          onClick={() => setPeople((p) => Math.max(1, p - 1))}
          disabled={busy}
        >
          -
        </button>
        <div className="w-12 text-center">{people}</div>
        <button
          className="border rounded px-3 py-1"
          onClick={() => setPeople((p) => Math.min(20, p + 1))}
          disabled={busy}
        >
          +
        </button>
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <button
        className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
        onClick={onConfirm}
        disabled={busy}
      >
        确认
      </button>
    </div>
  );
}


