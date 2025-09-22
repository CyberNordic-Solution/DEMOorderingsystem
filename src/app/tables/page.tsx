"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Table, Order, MenuCategory, MenuItem, OrderItem } from "@/lib/types";

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [ordersByTable, setOrdersByTable] = useState<Record<string, Order[]>>(
    {},
  );
  const [error, setError] = useState<string | null>(null);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [showBulkPaymentModal, setShowBulkPaymentModal] = useState(false);
  const [orderTotals, setOrderTotals] = useState<Record<string, number>>({});

  const load = async () => {
    const [{ data: ts }, { data: os }] = await Promise.all([
      supabase
        .from("tables")
        .select("id, index_no, name, is_active")
        .order("index_no"),
      supabase
        .from("orders")
        .select("id, table_id, status, note, created_at")
        .order("created_at", { ascending: false }),
    ]);
    setTables((ts as Table[]) || []);
    const map: Record<string, Order[]> = {};
    const ordersList = (os as Order[] | null) || [];
    ordersList.forEach((o) => {
      // 只显示未完成的订单
      if (o.status !== "completed") {
        map[o.table_id] = map[o.table_id] || [];
        map[o.table_id].push(o);
      }
    });
    setOrdersByTable(map);

    // 计算每个订单总金额
    try {
      const orderIds = ordersList.map((o) => o.id);
      if (orderIds.length > 0) {
        const { data: items } = await supabase
          .from("order_items")
          .select("order_id, price")
          .in("order_id", orderIds);
        const totals: Record<string, number> = {};
        (items as { order_id: string; price: number }[] | null)?.forEach((it) => {
          totals[it.order_id] = (totals[it.order_id] || 0) + (it.price || 0);
        });
        setOrderTotals(totals);
      } else {
        setOrderTotals({});
      }
    } catch (e) {
      // 忽略金额计算错误，保持页面可用
      console.error("加载订单金额失败", e);
    }
  };

  const loadMenuData = async () => {
    try {
      const [{ data: cats, error: catErr }, { data: items, error: itemErr }] =
        await Promise.all([
          supabase
            .from("menu_categories")
            .select("id, name, sort_order, is_active")
            .order("sort_order"),
          supabase
            .from("menu_items")
            .select("id, menu_id, name, price, category_id, is_active")
            .order("id"),
        ]);
      if (catErr) throw catErr;
      if (itemErr) throw itemErr;

      const catsArr = ((cats as MenuCategory[]) || []).slice();
      setCategories(catsArr);
      setMenuItems(((items as MenuItem[]) || []).slice());
      if (catsArr.length > 0) setActiveCategory(catsArr[0].id);
      if (catsArr.length === 0) setError("没有可用的菜单分类，请先到菜单设置中添加");
    } catch (e: unknown) {
      setError(
        `加载菜单失败: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  useEffect(() => {
    load().catch((e) => setError(String(e?.message || e)));
  }, []);

  // 当页面获得焦点时重新加载数据（处理从设置页面返回的情况）
  useEffect(() => {
    const handleFocus = () => {
      load().catch((e) => setError(String(e?.message || e)));
    };

    // 页面加载时立即执行一次
    handleFocus();

    // 监听页面可见性变化
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        handleFocus();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const addBill = async (tableId: string) => {
    setSelectedTableId(tableId);
    await loadMenuData();
    setShowMenuModal(true);
  };

  const toggleOrderSelection = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const selectAllOrders = (tableId: string) => {
    const tableOrders = ordersByTable[tableId] || [];
    setSelectedOrders(new Set(tableOrders.map((order) => order.id)));
  };

  const clearOrderSelection = () => {
    setSelectedOrders(new Set());
  };

  const handleBulkPayment = async () => {
    if (selectedOrders.size === 0) {
      alert("请选择要付款的订单");
      return;
    }
    setShowBulkPaymentModal(true);
  };

  const createOrderWithItems = async (
    selectedItems: { itemId: string; quantity: number }[],
  ) => {
    if (!selectedTableId || selectedItems.length === 0) return;

    try {
      let orderId: string;

      if (selectedOrder) {
        // 加菜到现有订单
        orderId = selectedOrder.id;
      } else {
        // 创建新订单
        const note = prompt("订单备注(可选)") || null;

        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            table_id: selectedTableId,
            note,
            status: "pending",
          })
          .select()
          .single();

        if (orderError) {
          console.error("创建订单失败:", orderError);
          alert("创建订单失败: " + orderError.message);
          return;
        }

        orderId = order.id;
      }

      // 添加订单项目
      const orderItems = selectedItems.map(({ itemId, quantity }) => {
        const menuItem = menuItems.find((item) => item.id === itemId);
        return {
          order_id: orderId,
          menu_item_id: itemId,
          quantity,
          unit_price: menuItem?.price || 0,
          price: (menuItem?.price || 0) * quantity,
        };
      });

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);
      if (itemsError) {
        console.error("添加订单项目失败:", itemsError);
        alert("添加订单项目失败: " + itemsError.message);
        return;
      }

      if (selectedOrder) {
        alert("加菜成功！");
      } else {
        alert(`订单创建成功！订单ID: ${orderId}`);
      }
    } catch (error) {
      console.error("创建订单时出错:", error);
      alert("创建订单时出错: " + String(error));
    }

    setShowMenuModal(false);
    setSelectedTableId(null);
    setSelectedOrder(null);
    // 延迟一下再加载，确保数据库操作完成
    setTimeout(() => {
      load();
    }, 500);
  };

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  const viewOrder = async (orderId: string) => {
    try {
      // 加载订单详情
      const { data: orderData } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      const { data: itemsData } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);

      // 为避免“未知菜品”与加菜价格为 0 的问题，这里加载完整菜单数据
      await loadMenuData();

      setSelectedOrder(orderData);
      setSelectedTableId(orderData.table_id); // 设置餐桌ID，用于加菜
      setOrderItems(itemsData || []);
      setShowOrderModal(true);
    } catch (error) {
      console.error("加载订单详情失败:", error);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-lg sm:text-xl font-semibold">餐桌</h1>
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tables.map((t) => (
          <div key={t.id} className="border rounded p-4 sm:p-3 space-y-2">
            <div className="flex justify-between items-center">
              <div className="font-medium text-base sm:text-sm">{t.name}</div>
              <div className="text-xs text-gray-500">
                {(ordersByTable[t.id] || []).length} 个订单
              </div>
            </div>

            {/* 批量操作按钮 */}
            {(ordersByTable[t.id] || []).length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  onClick={() => selectAllOrders(t.id)}
                  className="px-2 py-2 sm:py-1 bg-blue-500 text-white rounded hover:bg-blue-600 w-full sm:w-auto min-h-11 sm:min-h-0"
                >
                  全选
                </button>
                <button
                  onClick={clearOrderSelection}
                  className="px-2 py-2 sm:py-1 bg-gray-500 text-white rounded hover:bg-gray-600 w-full sm:w-auto min-h-11 sm:min-h-0"
                >
                  清除
                </button>
                {selectedOrders.size > 0 && (
                  <button
                    onClick={handleBulkPayment}
                    className="px-2 py-2 sm:py-1 bg-green-500 text-white rounded hover:bg-green-600 w-full sm:w-auto min-h-11 sm:min-h-0"
                  >
                    批量付款 ({selectedOrders.size})
                  </button>
                )}
              </div>
            )}

            <div className="space-y-2">
              {(ordersByTable[t.id] || [])
                .slice()
                .sort((a, b) => {
                  // 自然排序：按 note 中的编号或 id 尾段进行排序
                  const extractId = (note: string | null, id: string) => {
                    const noteStr = String(note || "");
                    const idStr = String(id || "");
                    const m = noteStr.match(/#?(\d+)/);
                    if (m) return parseInt(m[1], 10);
                    const tail = idStr.replace(/\D/g, "").slice(-6);
                    return tail ? parseInt(tail, 10) : Number.MAX_SAFE_INTEGER;
                  };
                  return extractId(a.note, a.id) - extractId(b.note, b.id);
                })
                .map((o) => (
                <div
                  key={o.id}
                  className={`border rounded px-3 py-3 sm:p-2 text-sm flex items-center justify-between ${
                    selectedOrders.has(o.id)
                      ? "bg-blue-50 border-blue-300"
                      : "bg-gray-50"
                  }`}
                >
                  <div className="flex items-center flex-1">
                    <input
                      type="checkbox"
                      checked={selectedOrders.has(o.id)}
                      onChange={() => toggleOrderSelection(o.id)}
                    className="mr-3 w-4 h-4"
                    />
                    <div className="flex-1">
                    <div className="truncate font-medium text-black text-sm sm:text-base">
                        {o.note || `订单 #${o.id}`}
                      </div>
                    <div className="text-[11px] sm:text-xs text-gray-500 hidden sm:block">
                        状态:{" "}
                        {o.status === "pending"
                          ? "待处理"
                          : o.status === "completed"
                            ? "已完成"
                            : o.status === "cancelled"
                              ? "已取消"
                              : o.status}
                        {o.created_at &&
                          ` | ${new Date(o.created_at).toLocaleTimeString()}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-green-600 whitespace-nowrap">
                      {(Number(orderTotals[o.id] || 0) / 100).toFixed(2)} Kr
                    </span>
                    <button
                      onClick={() => viewOrder(o.id)}
                    className="px-3 py-2 sm:py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 min-h-11 sm:min-h-0"
                    >
                      查看
                    </button>
                  </div>
                </div>
              ))}
              {(ordersByTable[t.id] || []).length === 0 && (
                <div className="text-center text-gray-400 text-sm py-2">
                  暂无订单
                </div>
              )}
            </div>

            <button
              className="border rounded px-3 py-1"
              onClick={() => addBill(t.id)}
            >
              + 新增订单
            </button>
          </div>
        ))}
      </div>

      {/* 菜单选择模态框 */}
      {showMenuModal && (
        <MenuSelectionModal
          categories={categories}
          menuItems={menuItems}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          onClose={() => {
            setShowMenuModal(false);
            setSelectedTableId(null);
            setSelectedOrder(null);
          }}
          onCreateOrder={createOrderWithItems}
          isAddingItems={!!selectedOrder}
        />
      )}

      {/* 订单详情模态框 */}
      {showOrderModal && selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          orderItems={orderItems}
          menuItems={menuItems}
          onClose={() => {
            setShowOrderModal(false);
            setSelectedOrder(null);
          }}
          onAddItems={async () => {
            setShowOrderModal(false);
            await loadMenuData();
            setShowMenuModal(true);
          }}
        />
      )}

      {/* 批量付款模态框 */}
      {showBulkPaymentModal && (
        <BulkPaymentModal
          selectedOrderIds={Array.from(selectedOrders)}
          ordersByTable={ordersByTable}
          onClose={() => {
            setShowBulkPaymentModal(false);
            setSelectedOrders(new Set());
          }}
        />
      )}
    </div>
  );
}

// 批量付款模态框组件
function BulkPaymentModal({
  selectedOrderIds,
  ordersByTable,
  onClose,
}: {
  selectedOrderIds: string[];
  ordersByTable: Record<string, Order[]>;
  onClose: () => void;
}) {
  const [allOrderItems, setAllOrderItems] = useState<OrderItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [paymentType, setPaymentType] = useState<"full" | "partial">("full");

  useEffect(() => {
    const loadBulkPaymentData = async () => {
      try {
        // 加载所有选中订单的菜品
        const { data: itemsData } = await supabase
          .from("order_items")
          .select("*")
          .in("order_id", selectedOrderIds);

        // 加载菜单数据
        const { data: menuData } = await supabase
          .from("menu_items")
          .select("id, menu_id, name, price, category_id, is_active, created_at");

        setAllOrderItems(itemsData || []);
        setMenuItems(menuData || []);
      } catch (error) {
        console.error("加载批量付款数据失败:", error);
      }
    };

    loadBulkPaymentData();
  }, [selectedOrderIds]);

  const getMenuItemName = (menuItemId: string) => {
    const item = menuItems.find((item) => item.id === menuItemId);
    return item?.name || "未知菜品";
  };

  const getMenuItemId = (menuItemId: string) => {
    const item = menuItems.find((item) => item.id === menuItemId);
    return item?.menu_id
      ? `#${item.menu_id}`
      : `#${String(item?.id || "").slice(-6)}`;
  };

  const getOrderInfo = (orderId: string) => {
    for (const tableOrders of Object.values(ordersByTable)) {
      const order = tableOrders.find((o) => o.id === orderId);
      if (order) return order;
    }
    return null;
  };

  const totalAmount = allOrderItems.reduce((sum, item) => {
    return sum + item.price;
  }, 0);

  const selectedAmount = allOrderItems.reduce((sum, item) => {
    return sum + (selectedItems.has(item.id) ? item.price : 0);
  }, 0);

  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    setSelectedItems(new Set(allOrderItems.map((item) => item.id)));
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  const handlePayment = async () => {
    try {
      if (paymentType === "full") {
        // 全买单 - 更新所有选中订单的状态
        const { error } = await supabase
          .from("orders")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .in("id", selectedOrderIds);

        if (error) throw error;
        alert("所有订单已完成付款！");
      } else {
        // 部分买单 - 更新选中的菜品
        const selectedItemIds = Array.from(selectedItems);
        const { error } = await supabase
          .from("order_items")
          .update({ is_paid: true })
          .in("id", selectedItemIds);

        if (error) throw error;
        alert("选中项目已付款！");
      }

      onClose();
      // 刷新数据
      window.location.reload();
    } catch (error) {
      console.error("批量付款失败:", error);
      alert("批量付款失败: " + String(error));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 sm:p-6 max-w-full w-full h-[100svh] sm:max-w-6xl sm:h-auto overflow-hidden flex flex-col mobile-modal">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-black">
            批量付款 - {selectedOrderIds.length} 个订单
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto -mx-2 sm:mx-0 px-2 sm:px-0">
          {/* 订单列表 */}
          <div className="mb-4">
            <h3 className="text-lg font-medium text-black mb-2">选中的订单:</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {selectedOrderIds.map((orderId) => {
                const order = getOrderInfo(orderId);
                return (
                  <div key={orderId} className="bg-gray-50 rounded p-2 text-sm">
                    <div className="font-medium text-black">
                      {order?.note || `订单 #${orderId}`}
                    </div>
                    <div className="text-xs text-gray-600">
                      状态:{" "}
                      {order?.status === "pending"
                        ? "待处理"
                        : order?.status === "completed"
                          ? "已完成"
                          : order?.status}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 菜品列表 */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-black">所有菜品:</h3>
            {allOrderItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center flex-1">
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={() => toggleItemSelection(item.id)}
                    className="mr-3"
                    disabled={paymentType === "full"}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-black">
                      {getMenuItemId(item.menu_item_id)}{" "}
                      {getMenuItemName(item.menu_item_id)}
                    </div>
                    <div className="text-sm text-gray-600">
                      单价: {(item.unit_price / 100).toFixed(2)} Kr
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-black">
                    {item.quantity} × {(item.unit_price / 100).toFixed(2)} Kr
                  </div>
                  <div className="text-lg font-bold text-green-600">
                    {(item.price / 100).toFixed(2)} Kr
                  </div>
                  {item.is_paid && (
                    <div className="text-xs text-green-600">✓ 已付款</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 总计 */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between items-center">
              <div className="text-lg font-semibold text-black">
                {paymentType === "partial" ? "选中项目总计" : "所有订单总计"}
              </div>
              <div className="text-2xl font-bold text-green-600">
                {(
                  paymentType === "partial"
                    ? selectedAmount / 100
                    : totalAmount / 100
                ).toFixed(2)} Kr
              </div>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="mt-4 pt-4 border-t space-y-3 sticky bottom-0 bg-white/95 backdrop-blur">
          {/* 买单方式选择 */}
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="bulkPaymentType"
                value="full"
                checked={paymentType === "full"}
                onChange={(e) =>
                  setPaymentType(e.target.value as "full" | "partial")
                }
                className="mr-2"
              />
              <span className="text-black">全买单</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="bulkPaymentType"
                value="partial"
                checked={paymentType === "partial"}
                onChange={(e) =>
                  setPaymentType(e.target.value as "full" | "partial")
                }
                className="mr-2"
              />
              <span className="text-black">选择买单</span>
            </label>
          </div>

          {/* 部分买单时的选择按钮 */}
          {paymentType === "partial" && (
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                全选
              </button>
              <button
                onClick={clearSelection}
                className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
              >
                清除选择
              </button>
            </div>
          )}

          {/* 主要操作按钮 */}
          <div className="flex gap-3">
            <button
              onClick={handlePayment}
              className="flex-1 py-2 bg-green-500 text-white rounded hover:bg-green-600 font-medium"
            >
              💳 确认批量付款
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-medium"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 订单详情模态框组件
function OrderDetailModal({
  order,
  orderItems,
  menuItems,
  onClose,
  onAddItems,
}: {
  order: Order;
  orderItems: OrderItem[];
  menuItems: MenuItem[];
  onClose: () => void;
  onAddItems: () => void;
}) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [paymentType, setPaymentType] = useState<"full" | "partial">("full");
  const [deleting, setDeleting] = useState(false);

  const getMenuItemName = (menuItemId: string) => {
    const item = menuItems.find((item) => item.id === menuItemId);
    return item?.name || "未知菜品";
  };

  const getMenuItemId = (menuItemId: string) => {
    const item = menuItems.find((item) => item.id === menuItemId);
    return item?.menu_id
      ? `#${item.menu_id}`
      : `#${String(item?.id || "").slice(-6)}`;
  };

  const totalAmount = orderItems.reduce((sum, item) => {
    return sum + item.price;
  }, 0);

  const selectedAmount = orderItems.reduce((sum, item) => {
    return sum + (selectedItems.has(item.id) ? item.price : 0);
  }, 0);

  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    setSelectedItems(new Set(orderItems.map((item) => item.id)));
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  const handleDeleteSelectedItems = async () => {
    if (selectedItems.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedItems.size} 个项目吗？此操作不可撤销。`)) {
      return;
    }
    try {
      setDeleting(true);
      const ids = Array.from(selectedItems);
      const { error } = await supabase.from("order_items").delete().in("id", ids);
      if (error) throw error;
      alert("已删除选中项目");
      onClose();
      window.location.reload();
    } catch (e) {
      console.error("删除选中项目失败:", e);
      alert("删除选中项目失败: " + String((e as any)?.message || e));
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!confirm("确定要删除整个订单吗？此操作不可撤销。")) return;
    try {
      setDeleting(true);
      // 先删除 order_items，再删除订单
      await supabase.from("order_items").delete().eq("order_id", order.id);
      const { error } = await supabase.from("orders").delete().eq("id", order.id);
      if (error) throw error;
      alert("订单已删除");
      onClose();
      window.location.reload();
    } catch (e) {
      console.error("删除订单失败:", e);
      alert("删除订单失败: " + String((e as any)?.message || e));
    } finally {
      setDeleting(false);
    }
  };

  const handlePayment = async () => {
    try {
      if (paymentType === "full") {
        // 全买单
        const { error } = await supabase
          .from("orders")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", order.id);

        if (error) throw error;
        alert("订单已完成付款！");
      } else {
        // 部分买单
        const selectedItemIds = Array.from(selectedItems);
        const { error } = await supabase
          .from("order_items")
          .update({ is_paid: true })
          .in("id", selectedItemIds);

        if (error) throw error;
        alert("选中项目已付款！");
      }

      onClose();
      // 刷新数据
      window.location.reload();
    } catch (error) {
      console.error("付款失败:", error);
      alert("付款失败: " + String(error));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 sm:p-6 max-w-full w-full h-[100svh] sm:max-w-4xl sm:h-auto overflow-hidden flex flex-col mobile-modal">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-black">
            订单详情 - {order.note || `订单 #${order.id}`}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto -mx-2 sm:mx-0 px-2 sm:px-0">
          {/* 订单信息 */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="text-sm text-gray-600">
              状态:{" "}
              {order.status === "pending"
                ? "待处理"
                : order.status === "completed"
                  ? "已完成"
                  : order.status}
              <br />
              创建时间: {new Date(order.created_at).toLocaleString()}
            </div>
          </div>

          {/* 菜品列表 */}
          <div className="space-y-2">
            {orderItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center flex-1">
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={() => toggleItemSelection(item.id)}
                    className="mr-3"
                    disabled={paymentType === "full"}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-black">
                      {getMenuItemId(item.menu_item_id)}{" "}
                      {getMenuItemName(item.menu_item_id)}
                    </div>
                    <div className="text-sm text-gray-600">
                      单价: {(item.unit_price / 100).toFixed(2)} Kr
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-black">
                    {item.quantity} × {(item.unit_price / 100).toFixed(2)} Kr
                  </div>
                  <div className="text-lg font-bold text-green-600">
                    {(item.price / 100).toFixed(2)} Kr
                  </div>
                  {item.is_paid && (
                    <div className="text-xs text-green-600">✓ 已付款</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 总计 */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between items-center">
              <div className="text-lg font-semibold text-black">
                {paymentType === "partial" ? "选中项目总计" : "订单总计"}
              </div>
              <div className="text-2xl font-bold text-green-600">
                {(
                  paymentType === "partial"
                    ? selectedAmount / 100
                    : totalAmount / 100
                ).toFixed(2)} Kr
              </div>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="mt-4 pt-4 border-t space-y-3 sticky bottom-0 bg-white/95 backdrop-blur">
          {/* 买单方式选择 */}
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="paymentType"
                value="full"
                checked={paymentType === "full"}
                onChange={(e) =>
                  setPaymentType(e.target.value as "full" | "partial")
                }
                className="mr-2"
              />
              <span className="text-black">全买单</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="paymentType"
                value="partial"
                checked={paymentType === "partial"}
                onChange={(e) =>
                  setPaymentType(e.target.value as "full" | "partial")
                }
                className="mr-2"
              />
              <span className="text-black">选择买单</span>
            </label>
          </div>

          {/* 部分买单时的选择按钮 */}
          {paymentType === "partial" && (
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                全选
              </button>
              <button
                onClick={clearSelection}
                className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
              >
                清除选择
              </button>
            </div>
          )}

          {/* 主要操作按钮 */}
        <div className="flex gap-3">
            <button
              onClick={handlePayment}
              className="flex-1 py-2 bg-green-500 text-white rounded hover:bg-green-600 font-medium"
            >
              💳 确认付款
            </button>
            <button
              onClick={onAddItems}
              className="flex-1 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium"
            >
              ➕ 加菜
            </button>
          <button
            onClick={handleDeleteSelectedItems}
            disabled={deleting || selectedItems.size === 0}
            className="flex-1 py-2 bg-red-500 text-white rounded hover:bg-red-600 font-medium disabled:opacity-50"
          >
            🗑️ 删除所选
          </button>
          <button
            onClick={handleDeleteOrder}
            disabled={deleting}
            className="flex-1 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium disabled:opacity-50"
          >
            ⚠️ 删除订单
          </button>
            <button
              onClick={onClose}
              className="flex-1 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-medium"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 菜单选择模态框组件
function MenuSelectionModal({
  categories,
  menuItems,
  activeCategory,
  onCategoryChange,
  onClose,
  onCreateOrder,
  isAddingItems = false,
}: {
  categories: MenuCategory[];
  menuItems: MenuItem[];
  activeCategory: string | null;
  onCategoryChange: (categoryId: string) => void;
  onClose: () => void;
  onCreateOrder: (
    selectedItems: { itemId: string; quantity: number }[],
  ) => void;
  isAddingItems?: boolean;
}) {
  const [selectedItems, setSelectedItems] = useState<
    { itemId: string; quantity: number }[]
  >([]);
  const [localCategories, setLocalCategories] = useState<MenuCategory[]>(categories);
  const [localMenuItems, setLocalMenuItems] = useState<MenuItem[]>(menuItems);
  const [localError, setLocalError] = useState<string | null>(null);
  // Mobile collapsible panels (默认展开“已选”)
  const [showCatMobile, setShowCatMobile] = useState<boolean>(false);
  const [showSelectedMobile, setShowSelectedMobile] = useState<boolean>(true);

  // 自然排序 key 生成：前缀（字母）+ 数字
  const naturalKey = (id?: string | null) => {
    if (!id) return { prefix: "", num: Number.POSITIVE_INFINITY };
    const match = String(id).match(/^(\D*)(\d*)$/);
    const prefix = (match?.[1] || "").toUpperCase();
    const num = match?.[2] ? parseInt(match[2] || "0", 10) : Number.POSITIVE_INFINITY;
    return { prefix, num };
  };

  // 同步父级数据到本地
  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);
  useEffect(() => {
    setLocalMenuItems(menuItems);
  }, [menuItems]);

  // 若未有激活分类而分类已加载，则自动选中第一个
  useEffect(() => {
    if (!activeCategory && localCategories.length > 0) {
      onCategoryChange(localCategories[0].id);
    }
  }, [activeCategory, localCategories, onCategoryChange]);

  // 兜底：如果父级传入为空，则在弹窗内自发加载一次，避免出现空白
  useEffect(() => {
    const fallbackLoad = async () => {
      try {
        if (localCategories.length === 0 || localMenuItems.length === 0) {
          const [{ data: cats }, { data: items }] = await Promise.all([
            supabase
              .from("menu_categories")
              .select("id, name, sort_order, is_active")
              .order("sort_order"),
            supabase
              .from("menu_items")
              .select("id, menu_id, name, price, category_id, is_active")
              .order("id"),
          ]);
          const c = (cats as MenuCategory[]) || [];
          const m = (items as MenuItem[]) || [];
          if (c.length > 0) setLocalCategories(c);
          if (m.length > 0) setLocalMenuItems(m);
          if (!activeCategory && c.length > 0) onCategoryChange(c[0].id);
        }
      } catch (e: unknown) {
        setLocalError(`加载菜单失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    };
    fallbackLoad();
  }, [activeCategory, localCategories.length, localMenuItems.length, onCategoryChange]);

  const addItemToSelection = (itemId: string) => {
    const existing = selectedItems.find((item) => item.itemId === itemId);
    if (existing) {
      setSelectedItems(
        selectedItems.map((item) =>
          item.itemId === itemId
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        ),
      );
    } else {
      setSelectedItems([...selectedItems, { itemId, quantity: 1 }]);
    }
  };

  const removeItemFromSelection = (itemId: string) => {
    setSelectedItems(selectedItems.filter((item) => item.itemId !== itemId));
  };

  const updateItemQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItemFromSelection(itemId);
    } else {
      setSelectedItems(
        selectedItems.map((item) =>
          item.itemId === itemId ? { ...item, quantity } : item,
        ),
      );
    }
  };

  const getItemName = (itemId: string) => {
    const item = menuItems.find((item) => item.id === itemId);
    return item?.name || "";
  };

  const getItemPrice = (itemId: string) => {
    const item = menuItems.find((item) => item.id === itemId);
    return item?.price || 0;
  };

  const totalAmount = selectedItems.reduce((sum, item) => {
    return sum + getItemPrice(item.itemId) * item.quantity;
  }, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 sm:p-6 max-w-full w-full h-[100svh] sm:max-w-4xl sm:h-auto overflow-hidden flex flex-col mobile-modal">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">选择菜品</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        {/* Mobile toggles */}
        <div className="sm:hidden grid grid-cols-2 gap-2 mb-2">
          <button
            onClick={() => setShowCatMobile((v) => !v)}
            className={`py-2 rounded font-medium ${showCatMobile ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'} hover:bg-blue-600`}
          >
            {showCatMobile ? "收起分类" : "展开分类"}
          </button>
          <button
            onClick={() => setShowSelectedMobile((v) => !v)}
            className={`py-2 rounded font-medium ${showSelectedMobile ? 'bg-emerald-600 text-white' : 'bg-emerald-500 text-white'} hover:bg-emerald-600`}
          >
            {showSelectedMobile ? "收起已选" : `已选(${selectedItems.length})`}
          </button>
        </div>

        <div className="flex-1 flex flex-col sm:flex-row gap-4 overflow-hidden">
          {/* 左侧：菜单分类 */}
          <div className={`${showCatMobile ? 'block' : 'hidden'} sm:block w-full sm:w-36 flex flex-col sm:flex-none`}>
            <h3 className="font-medium mb-3 text-black">菜单分类</h3>
            <div className="max-h-[30vh] sm:max-h-none flex-1 overflow-y-auto space-y-2">
              {localCategories.length === 0 && (
                <div className="text-xs text-gray-500">暂无分类</div>
              )}
              {localCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => onCategoryChange(cat.id)}
                  className={`w-full text-left px-3 py-2 rounded text-sm ${
                    activeCategory === cat.id
                      ? "bg-gray-200 text-black"
                      : "bg-gray-100 text-black hover:bg-gray-200"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* 中间：菜品列表 */}
          <div className="flex-1 flex flex-col order-panel-fixed min-w-0">
            <h3 className="font-medium mb-3 text-black">菜品列表</h3>
            <div className="flex-1 overflow-y-auto space-y-2">
              {localError && (
                <div className="text-xs text-red-600">{localError}</div>
              )}
              {localMenuItems.filter((i) => i.category_id === activeCategory).length === 0 && (
                <div className="text-xs text-gray-500">暂无菜品</div>
              )}
              {localMenuItems
                .filter((item) => item.category_id === activeCategory)
                .slice()
                .sort((a, b) => {
                  const ak = naturalKey(a.menu_id);
                  const bk = naturalKey(b.menu_id);
                  if (ak.prefix !== bk.prefix) return ak.prefix.localeCompare(bk.prefix);
                  if (ak.num !== bk.num) return ak.num - bk.num;
                  return (a.name || "").localeCompare(b.name || "");
                })
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 border rounded gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-black truncate whitespace-nowrap" title={`${item.menu_id ? `#${item.menu_id}` : `#${String(item.id).slice(-6)}`} ${item.name}`}>
                        {item.menu_id
                          ? `#${item.menu_id}`
                          : `#${String(item.id).slice(-6)}`} {" "}
                        {item.name}
                      </div>
                      <div className="text-sm text-black">
                        {(item.price / 100).toFixed(2)} Kr
                      </div>
                    </div>
                    <button
                      onClick={() => addItemToSelection(item.id)}
                      className="px-3 py-2 sm:py-1 bg-blue-500 text-white rounded hover:bg-blue-600 flex-shrink-0"
                    >
                      添加
                    </button>
                  </div>
                ))}
            </div>
          </div>

          {/* 右侧：已选择的菜品 */}
          <div className={`${showSelectedMobile ? 'block' : 'hidden'} sm:block w-full sm:w-96 border-l sm:pl-4 pl-0 order-panel-fixed`}>
            <h3 className="font-medium mb-3 text-black">已选择的菜品</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {selectedItems.map((item) => (
                <div
                  key={item.itemId}
                  className="flex items-center justify-between p-3 border rounded bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="text-base font-medium text-black truncate whitespace-nowrap">
                      {getItemName(item.itemId)}
                    </div>
                    <div className="text-sm text-black">
                      {(getItemPrice(item.itemId) / 100).toFixed(2)} Kr ×{" "}
                      {item.quantity}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        updateItemQuantity(item.itemId, item.quantity - 1)
                      }
                      className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center text-black hover:bg-gray-300"
                    >
                      -
                    </button>
                    <span className="w-10 text-center text-black font-medium">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        updateItemQuantity(item.itemId, item.quantity + 1)
                      }
                      className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center text-black hover:bg-gray-300"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t">
              <div className="text-xl font-semibold mb-3 text-black">
                总计: {(totalAmount / 100).toFixed(2)} Kr
              </div>
              <button
                onClick={() => onCreateOrder(selectedItems)}
                disabled={selectedItems.length === 0}
                className="w-full py-3 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-lg font-medium"
              >
                {isAddingItems
                  ? `加菜 (${selectedItems.length} 项)`
                  : `创建订单 (${selectedItems.length} 项)`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
