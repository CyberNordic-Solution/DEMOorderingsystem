"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { MenuItem } from "@/lib/types";

export default function AdminMenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("menu_items")
      .select("id, name, price, category, is_active")
      .order("name");
    if (error) setError(error.message);
    else setItems((data as any) || []);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const add = async () => {
    if (!name || price <= 0) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("menu_items")
        .insert({ name, price: Math.round(price * 100), is_active: true });
      if (error) throw error;
      setName("");
      setPrice(0);
      fetchItems();
    } catch (err: any) {
      setError(err?.message ?? "");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (it: MenuItem) => {
    await supabase.from("menu_items").update({ is_active: !it.is_active }).eq("id", it.id);
    fetchItems();
  };

  const remove = async (id: string) => {
    await supabase.from("menu_items").delete().eq("id", id);
    fetchItems();
  };

  const updatePrice = async (it: MenuItem, newPriceYuan: number) => {
    if (newPriceYuan <= 0) return;
    await supabase.from("menu_items").update({ price: Math.round(newPriceYuan * 100) }).eq("id", it.id);
    fetchItems();
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">菜单管理</h1>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <div className="flex items-end gap-3">
        <div className="flex flex-col">
          <label className="text-sm text-gray-600">菜品名</label>
          <input className="border rounded px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col">
          <label className="text-sm text-gray-600">价格（元）</label>
          <input
            type="number"
            className="border rounded px-3 py-2"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            min={0}
            step={0.01}
          />
        </div>
        <button disabled={busy} onClick={add} className="rounded bg-black text-white px-4 py-2 disabled:opacity-50">
          新增
        </button>
      </div>

      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className="flex items-center justify-between border rounded px-3 py-2">
            <div className="flex items-center gap-4">
              <div className="w-48 truncate">{it.name}</div>
              <div className="flex items-center gap-2">
                <span>￥</span>
                <input
                  type="number"
                  defaultValue={(it.price / 100).toFixed(2)}
                  className="border rounded px-2 py-1 w-24"
                  min={0}
                  step={0.01}
                  onBlur={(e) => updatePrice(it, Number(e.target.value))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="border rounded px-3 py-1" onClick={() => toggleActive(it)}>
                {it.is_active ? "下架" : "上架"}
              </button>
              <button className="border rounded px-3 py-1" onClick={() => remove(it.id)}>
                删除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


