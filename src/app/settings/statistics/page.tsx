"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function StatisticsPage() {
  const [incomeToday, setIncomeToday] = useState<number>(0);
  const [topItems, setTopItems] = useState<{ name: string; qty: number }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const { data: pays } = await supabase
          .from("payments")
          .select("amount, created_at")
          .gte("created_at", start.toISOString());
        setIncomeToday((pays || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0));

        const { data: items } = await supabase
          .from("order_items")
          .select("quantity, menu_item_id, menu_items(name)")
          .eq("is_paid", true)
          .gte("created_at", start.toISOString());
        const map = new Map<string, number>();
        (items || []).forEach((r: any) => {
          const key = r.menu_items?.name || r.menu_item_id;
          map.set(key, (map.get(key) || 0) + Number(r.quantity || 0));
        });
        setTopItems(Array.from(map.entries()).map(([name, qty]) => ({ name, qty })).slice(0, 10));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      }
    })();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">统计</h1>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <div>今日收入：￥{(incomeToday / 100).toFixed(2)}</div>
      <div>
        <div className="font-medium mb-2">今日热销</div>
        <div className="space-y-1">
          {topItems.map((t) => (
            <div key={t.name} className="flex justify-between">
              <span>{t.name}</span>
              <span>x{t.qty}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


