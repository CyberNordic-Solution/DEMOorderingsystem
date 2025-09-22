"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SettingsPage() {
  const router = useRouter();
  const [numTables, setNumTables] = useState<number>(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("num_tables")
        .limit(1)
        .single();
      if (error && error.code !== "PGRST116") throw error; // ignore no rows
      if (data?.num_tables) setNumTables(Number(data.num_tables));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    try {
      setSaving(true);
      setError(null);
      // ensure single settings row exists
      const { data: currentSetting } = await supabase
        .from("app_settings")
        .select("id, num_tables")
        .limit(1)
        .single();
      if (!currentSetting) {
        const { error: insErr } = await supabase
          .from("app_settings")
          .insert({ num_tables: numTables });
        if (insErr) throw insErr;
      } else {
        const { error: updErr } = await supabase
          .from("app_settings")
          .update({
            num_tables: numTables,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentSetting.id);
        if (updErr) throw updErr;
      }

      // sync tables count to N (create missing, remove extras)
      const { data: rows } = await supabase
        .from("tables")
        .select("id, index_no");
      const existing = new Map<number, string>();
      (rows || []).forEach((r: { id: string; index_no: number }) =>
        existing.set(Number(r.index_no), r.id),
      );

      // inserts
      const need = Array.from(
        { length: Math.max(0, numTables) },
        (_, i) => i + 1,
      );
      const inserts = need
        .filter((n) => !existing.has(n))
        .map((n) => ({ index_no: n, name: `T${n}`, is_active: true }));
      if (inserts.length > 0) await supabase.from("tables").insert(inserts);

      // deletes (index_no > numTables)
      const toDelete = Array.from(existing.keys()).filter((n) => n > numTables);
      if (toDelete.length > 0) {
        const ids = toDelete.map((n) => existing.get(n)!).filter(Boolean);
        if (ids.length > 0)
          await supabase.from("tables").delete().in("id", ids);
      }

      // reload latest
      await load();
      // 保存成功后跳转到桌台页面
      router.push("/tables");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">加载中...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">设置</h1>
      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="flex items-end gap-3">
        <div className="flex flex-col">
          <label className="text-sm text-gray-600">餐桌数量</label>
          <input
            type="number"
            min={1}
            className="border rounded px-3 py-2 w-32"
            value={numTables}
            onChange={(e) => setNumTables(Number(e.target.value))}
          />
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="rounded bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-2 disabled:opacity-50 hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:scale-100"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              保存中...
            </span>
          ) : (
            <span className="flex items-center gap-2">💾 保存并同步桌台</span>
          )}
        </button>
      </div>

      <div className="flex gap-3">
        <Link href="/settings/general" className="rounded border px-4 py-2">
          通用设置
        </Link>
        <Link href="/settings/menu" className="rounded border px-4 py-2">
          菜单设置
        </Link>
      </div>
    </div>
  );
}
