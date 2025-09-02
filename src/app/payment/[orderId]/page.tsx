"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { OrderItem } from "@/lib/types";

export default function PaymentPage({ params }: { params: { orderId: string } }) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, order_id, menu_item_id, quantity, unit_price, is_paid")
        .eq("order_id", params.orderId)
        .eq("is_paid", false);
      if (error) setError(error.message);
      else setItems((data as any) || []);
    })();
  }, [params.orderId]);

  const sumAll = useMemo(
    () => items.reduce((s, it) => s + it.unit_price * it.quantity, 0),
    [items]
  );
  const sumSelected = useMemo(() => {
    return items
      .filter((it) => selected[it.id])
      .reduce((s, it) => s + it.unit_price * it.quantity, 0);
  }, [items, selected]);

  const toggle = (id: string) => setSelected((m) => ({ ...m, [id]: !m[id] }));

  const pay = async (mode: "all" | "selected") => {
    try {
      setBusy(true);
      setError(null);
      if (mode === "all") {
        await supabase
          .from("order_items")
          .update({ is_paid: true })
          .eq("order_id", params.orderId)
          .eq("is_paid", false);
      } else {
        const ids = Object.keys(selected).filter((k) => selected[k]);
        if (ids.length === 0) return;
        await supabase.from("order_items").update({ is_paid: true }).in("id", ids);
      }

      // close order if all items paid
      const { data: remain } = await supabase
        .from("order_items")
        .select("id")
        .eq("order_id", params.orderId)
        .eq("is_paid", false);
      if (!remain || remain.length === 0) {
        await supabase.from("orders").update({ status: "paid" }).eq("id", params.orderId);
      } else {
        await supabase.from("orders").update({ status: "partial_paid" }).eq("id", params.orderId);
      }

      location.replace("/tables");
    } catch (err: any) {
      setError(err?.message ?? "");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">结账</h1>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <div className="space-y-2">
        {items.map((it) => (
          <label key={it.id} className="flex items-center justify-between border rounded px-3 py-2">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={!!selected[it.id]}
                onChange={() => toggle(it.id)}
              />
              <span className="text-sm">x{it.quantity}</span>
            </div>
            <div>￥{((it.quantity * it.unit_price) / 100).toFixed(2)}</div>
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between font-medium">
        <div>全部：￥{(sumAll / 100).toFixed(2)}</div>
        <div>已选：￥{(sumSelected / 100).toFixed(2)}</div>
      </div>
      <div className="flex gap-3">
        <button
          disabled={busy}
          onClick={() => pay("all")}
          className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
        >
          全部结清
        </button>
        <button
          disabled={busy}
          onClick={() => pay("selected")}
          className="rounded border px-4 py-2 disabled:opacity-50"
        >
          仅结清已选
        </button>
      </div>
    </div>
  );
}


