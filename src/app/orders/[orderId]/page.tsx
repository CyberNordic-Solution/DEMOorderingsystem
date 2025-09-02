"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { MenuItem, OrderItem } from "@/lib/types";
import Link from "next/link";

export default function OrderDetailPage({ params }: { params: { orderId: string } }) {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(() => {
    return orderItems.reduce((s, oi) => s + oi.unit_price * oi.quantity, 0);
  }, [orderItems]);

  useEffect(() => {
    (async () => {
      const [{ data: m, error: e1 }, { data: oi, error: e2 }] = await Promise.all([
        supabase.from("menu_items").select("id, name, price, category, is_active").eq("is_active", true),
        supabase
          .from("order_items")
          .select("id, order_id, menu_item_id, quantity, unit_price, is_paid")
          .eq("order_id", params.orderId),
      ]);
      if (e1 || e2) {
        setError(e1?.message || e2?.message || "");
      } else {
        setMenu((m as any) || []);
        setOrderItems((oi as any) || []);
      }
    })();
  }, [params.orderId]);

  const addItem = async (mi: MenuItem) => {
    try {
      setBusy(true);
      const { data, error } = await supabase
        .from("order_items")
        .insert({ order_id: params.orderId, menu_item_id: mi.id, quantity: 1, unit_price: mi.price, is_paid: false })
        .select("id, order_id, menu_item_id, quantity, unit_price, is_paid")
        .single();
      if (error) throw error;
      setOrderItems((prev) => [...prev, data as any]);
    } catch (err: any) {
      setError(err?.message ?? "");
    } finally {
      setBusy(false);
    }
  };

  const updateQty = async (oi: OrderItem, delta: number) => {
    const nextQty = Math.max(0, oi.quantity + delta);
    if (nextQty === 0) {
      await supabase.from("order_items").delete().eq("id", oi.id);
      setOrderItems((prev) => prev.filter((x) => x.id !== oi.id));
      return;
    }
    await supabase.from("order_items").update({ quantity: nextQty }).eq("id", oi.id);
    setOrderItems((prev) => prev.map((x) => (x.id === oi.id ? { ...x, quantity: nextQty } : x)));
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">点单</h1>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {menu.map((m) => (
          <button
            key={m.id}
            disabled={busy}
            onClick={() => addItem(m)}
            className="border rounded p-3 text-left hover:bg-gray-50 disabled:opacity-50"
          >
            <div className="font-medium">{m.name}</div>
            <div className="text-sm text-gray-500">￥{(m.price / 100).toFixed(2)}</div>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">已选</h2>
        <div className="space-y-2">
          {orderItems.map((oi) => (
            <div key={oi.id} className="flex items-center justify-between border rounded px-3 py-2">
              <div className="flex items-center gap-3">
                <span className="w-28 truncate">
                  {menu.find((m) => m.id === oi.menu_item_id)?.name ?? ""}
                </span>
                <div className="text-gray-500">￥{(oi.unit_price / 100).toFixed(2)}</div>
              </div>
              <div className="flex items-center gap-2">
                <button className="border rounded px-2" onClick={() => updateQty(oi, -1)}>-</button>
                <span className="w-6 text-center">{oi.quantity}</span>
                <button className="border rounded px-2" onClick={() => updateQty(oi, 1)}>+</button>
              </div>
            </div>
          ))}
        </div>
        <div className="text-right font-medium">合计：￥{(total / 100).toFixed(2)}</div>
      </div>

      <div className="flex gap-3">
        <Link
          href={`/payment/${params.orderId}`}
          className="rounded bg-black text-white px-4 py-2"
        >
          去结账
        </Link>
      </div>
    </div>
  );
}


