"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Category = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};
type Item = {
  id: string;
  menu_id?: string;
  name: string;
  price: number;
  category_id: string | null;
  is_active: boolean;
};

export default function MenuSettingsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const load = async () => {
    const [{ data: cats }, { data: its }] = await Promise.all([
      supabase
        .from("menu_categories")
        .select("id, name, sort_order, is_active")
        .order("sort_order"),
      supabase
        .from("menu_items")
        .select("id, menu_id, name, price, category_id, is_active")
        .order("menu_id", { ascending: true }),
    ]);
    setCategories((cats as any) || []);
    // 对菜品进行数字排序
    const sortedItems = (its as any) || [];
    sortedItems.sort((a: any, b: any) => {
      const aId = parseInt(a.menu_id) || 0;
      const bId = parseInt(b.menu_id) || 0;
      return aId - bId;
    });
    setItems(sortedItems);
    if (!activeCat && cats && cats.length > 0)
      setActiveCat((cats[0] as any).id);
  };

  useEffect(() => {
    load().catch((e) => setError(String(e?.message || e)));
  }, []);

  const addCategory = async () => {
    const name = prompt("分类名");
    if (!name) return;
    await supabase.from("menu_categories").insert({
      name,
      sort_order: (categories?.length || 0) + 1,
      is_active: true,
    });
    load();
  };

  const addItem = async () => {
    if (!activeCat) return;
    const menuId = prompt("菜单ID (可选)");
    const name = prompt("菜名");
    if (!name) return;
    const priceY = Number(prompt("价格(Kr)") || 0);
    await supabase.from("menu_items").insert({
      menu_id: menuId || null,
      name,
      price: Math.round(priceY * 100),
      category_id: activeCat,
      is_active: true,
    });
    load();
  };

  const toggleItem = async (it: Item) => {
    await supabase
      .from("menu_items")
      .update({ is_active: !it.is_active })
      .eq("id", it.id);
    load();
  };

  const deleteItem = async (it: Item) => {
    if (!confirm(`确定要删除菜品 "${it.name}" 吗？此操作无法撤销。`)) {
      return;
    }
    await supabase.from("menu_items").delete().eq("id", it.id);
    load();
  };

  const editItem = async (it: Item) => {
    const newMenuId = prompt("菜单ID (可选)", it.menu_id || "");
    const newName = prompt("菜名", it.name);
    if (!newName) return;
    const newPrice = Number(
      prompt("价格(Kr)", String((it.price / 100).toFixed(2))) || 0,
    );

    await supabase
      .from("menu_items")
      .update({
        menu_id: newMenuId || null,
        name: newName,
        price: Math.round(newPrice * 100),
      })
      .eq("id", it.id);
    load();
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const selectAllItems = () => {
    const currentItems = items.filter((it) => it.category_id === activeCat);
    setSelectedItems(new Set(currentItems.map((it) => it.id)));
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  const updateSelectedItemsPrice = async () => {
    if (selectedItems.size === 0) return;
    const newPrice = Number(prompt("新价格(Kr)") || 0);
    if (newPrice <= 0) return;

    const updates = Array.from(selectedItems).map((id) =>
      supabase
        .from("menu_items")
        .update({ price: Math.round(newPrice * 100) })
        .eq("id", id),
    );

    await Promise.all(updates);
    load();
    setSelectedItems(new Set());
  };

  const toggleSelectedItems = async () => {
    if (selectedItems.size === 0) return;

    const updates = Array.from(selectedItems).map((id) => {
      const item = items.find((it) => it.id === id);
      if (!item) return Promise.resolve();
      return supabase
        .from("menu_items")
        .update({ is_active: !item.is_active })
        .eq("id", id);
    });

    await Promise.all(updates);
    load();
    setSelectedItems(new Set());
  };

  const deleteSelectedItems = async () => {
    if (selectedItems.size === 0) return;

    const itemNames = Array.from(selectedItems)
      .map((id) => items.find((it) => it.id === id)?.name)
      .filter(Boolean);

    if (
      !confirm(
        `确定要删除选中的 ${selectedItems.size} 个菜品吗？\n\n${itemNames.join("\n")}\n\n此操作无法撤销。`,
      )
    ) {
      return;
    }

    const deletes = Array.from(selectedItems).map((id) =>
      supabase.from("menu_items").delete().eq("id", id),
    );

    await Promise.all(deletes);
    load();
    setSelectedItems(new Set());
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4 dark:text-white">菜单设置</h1>
      {error && <div className="text-red-600 text-sm mb-4">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        <aside className="md:sticky md:top-16 md:self-start">
          <div className="flex md:flex-col gap-1 md:gap-2 overflow-auto max-h-[60vh] pr-1">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`text-left rounded px-2 md:px-3 py-1 md:py-2 border border-gray-200 dark:border-gray-700 ${
                  activeCat === c.id
                    ? "bg-gray-200 text-black dark:bg-gray-800 dark:text-white"
                    : "hover:bg-gray-200 hover:text-black dark:hover:bg-gray-800 dark:hover:text-white"
                }`}
              >
                {c.name}
              </button>
            ))}
            <button
              onClick={addCategory}
              className="rounded px-2 md:px-3 py-1 md:py-2 border border-gray-200 dark:border-gray-700 dark:text-gray-100"
            >
              + 新建分类
            </button>
          </div>
        </aside>

        <section className="space-y-2">
          {activeCat && (
            <div className="flex items-center gap-2 mb-4 p-2 bg-gray-50 dark:bg-gray-900/50 rounded">
              <span className="text-sm text-black dark:text-gray-100">
                已选择 {selectedItems.size} 项
              </span>
              <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span>已上架</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span>已下架</span>
                </div>
              </div>
              <button
                onClick={selectAllItems}
                className="text-sm border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-black dark:text-gray-100"
              >
                全选
              </button>
              <button
                onClick={clearSelection}
                className="text-sm border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-black dark:text-gray-100"
              >
                清除选择
              </button>
              {selectedItems.size > 0 && (
                <>
                  <button
                    onClick={updateSelectedItemsPrice}
                    className="text-sm border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-blue-100 text-black dark:bg-blue-900/40 dark:text-blue-100"
                  >
                    批量改价
                  </button>
                  <button
                    onClick={toggleSelectedItems}
                    className="text-sm border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-orange-100 text-black dark:bg-orange-900/40 dark:text-orange-100"
                  >
                    批量上下架
                  </button>
                  <button
                    onClick={deleteSelectedItems}
                    className="text-sm border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"
                  >
                    批量删除
                  </button>
                </>
              )}
            </div>
          )}

          {items
            .filter((it) => it.category_id === activeCat)
            .map((it) => (
              <div
                key={it.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between border border-gray-200 dark:border-gray-700 rounded px-3 py-2 bg-white dark:bg-gray-900 gap-2 sm:gap-3"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={selectedItems.has(it.id)}
                    onChange={() => toggleItemSelection(it.id)}
                    className="w-4 h-4 flex-shrink-0 accent-blue-600 dark:accent-blue-400"
                  />
                  {/* 状态指示灯 */}
                  <div
                    className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      it.is_active
                        ? "bg-green-500 shadow-lg shadow-green-500/50"
                        : "bg-red-500 shadow-lg shadow-red-500/50"
                    }`}
                    title={it.is_active ? "已上架" : "已下架"}
                  ></div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="font-medium text-gray-700 dark:text-gray-200 truncate whitespace-nowrap">
                      {it.menu_id
                        ? `#${it.menu_id}`
                        : `#${String(it.id).slice(-6)}`}{" "}
                      {it.name}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3 flex-shrink-0 w-full sm:w-auto mt-1 sm:mt-0">
                  <div className="text-right font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                    {(it.price / 100).toFixed(2)} Kr
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="border border-gray-200 dark:border-gray-700 rounded px-2 sm:px-3 py-1 text-xs sm:text-sm dark:text-gray-100"
                      onClick={() => editItem(it)}
                    >
                      编辑
                    </button>
                    <button
                      className="border border-gray-200 dark:border-gray-700 rounded px-2 sm:px-3 py-1 text-xs sm:text-sm dark:text-gray-100"
                      onClick={() => toggleItem(it)}
                    >
                      {it.is_active ? "下架" : "上架"}
                    </button>
                    <button
                      className="border border-gray-200 dark:border-gray-700 rounded px-2 sm:px-3 py-1 text-xs sm:text-sm bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-300"
                      onClick={() => deleteItem(it)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          {activeCat && (
            <button
              onClick={addItem}
              className="border border-gray-200 dark:border-gray-700 rounded px-3 py-1 dark:text-gray-100"
            >
              + 菜品
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
