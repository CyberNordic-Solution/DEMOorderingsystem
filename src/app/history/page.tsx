"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Order = {
  id: string;
  table_id: string;
  status: string;
  note: string | null;
  created_at: string;
  completed_at?: string;
};

type OrderItem = {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  price: number;
  is_paid?: boolean;
};

type MenuItem = {
  id: string;
  menu_id?: string;
  name: string;
  price: number;
  category_id: string | null;
  is_active: boolean;
};

type Table = {
  id: string;
  index_no: number;
  name: string;
  is_active: boolean;
};

type PaymentRecord = {
  id: string;
  orderIds: string[];
  totalAmount: number;
  completedAt: string;
  tableNames: string[];
  items: OrderItem[];
};

export default function HistoryPage() {
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    try {
      setLoading(true);

      // 加载已完成的订单
      const { data: ordersData } = await supabase
        .from("orders")
        .select("id, table_id, status, note, created_at, completed_at")
        .eq("status", "completed")
        .order("completed_at", { ascending: false });

      // 加载餐桌信息
      const { data: tablesData } = await supabase
        .from("tables")
        .select("id, index_no, name, is_active");

      // 加载菜单信息
      const { data: menuData } = await supabase
        .from("menu_items")
        .select("id, menu_id, name, price, category_id, is_active");

      if (ordersData) {
        // 加载所有已完成订单的菜品
        const orderIds = ordersData.map((order) => order.id);
        let itemsData: any[] = [];
        if (orderIds.length > 0) {
          const { data: itemsResult } = await supabase
            .from("order_items")
            .select("*")
            .in("order_id", orderIds);

          itemsData = itemsResult || [];
          setOrderItems(itemsData);
        }

        // 按完成时间分组，合并同时完成的订单
        const ordersByTime = new Map<string, Order[]>();
        ordersData.forEach((order) => {
          if (order.completed_at) {
            const timeKey = order.completed_at;
            if (!ordersByTime.has(timeKey)) {
              ordersByTime.set(timeKey, []);
            }
            ordersByTime.get(timeKey)!.push(order);
          }
        });

        // 创建支付记录
        const records: PaymentRecord[] = [];
        ordersByTime.forEach((orders, completedAt) => {
          const orderIds = orders.map((order) => order.id);
          const tableNames = orders.map((order) => {
            const table = (tablesData as Table[])?.find(
              (t) => t.id === order.table_id,
            );
            return table?.name || "未知餐桌";
          });

          // 计算总金额
          const itemsForTheseOrders = itemsData.filter((item) =>
            orderIds.includes(item.order_id),
          );
          const totalAmount = itemsForTheseOrders.reduce(
            (sum, item) => sum + item.price,
            0,
          );

          records.push({
            id: `payment_${completedAt}`,
            orderIds,
            totalAmount,
            completedAt,
            tableNames,
            items: itemsForTheseOrders,
          });
        });

        // 按完成时间排序（最新的在前）
        records.sort(
          (a, b) =>
            new Date(b.completedAt).getTime() -
            new Date(a.completedAt).getTime(),
        );
        setPaymentRecords(records);
      }

      setTables((tablesData as Table[]) || []);
      setMenuItems((menuData as MenuItem[]) || []);
    } catch (error) {
      console.error("加载支付记录失败:", error);
      setError(String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

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

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">支付记录</h1>
        <button
          onClick={loadHistory}
          className="px-3 py-1 border rounded hover:bg-gray-100"
        >
          刷新
        </button>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {paymentRecords.length === 0 ? (
        <div className="text-center text-gray-500 py-8">暂无支付记录</div>
      ) : (
        <div className="space-y-4">
          {paymentRecords.map((record) => (
            <div key={record.id} className="border rounded-lg p-4 bg-gray-50">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-black">
                    支付记录 #
                    {record.orderIds.length > 1
                      ? `${record.orderIds[0]}-${record.orderIds[record.orderIds.length - 1]}`
                      : record.orderIds[0]}
                  </h3>
                  <div className="text-sm text-gray-600">
                    餐桌: {record.tableNames.join(", ")}
                  </div>
                  <div className="text-sm text-gray-600">
                    订单: {record.orderIds.map((id) => `#${id}`).join(", ")}
                  </div>
                  <div className="text-sm text-green-600">
                    完成时间: {new Date(record.completedAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-green-600">
                    {(record.totalAmount / 100).toFixed(2)} Kr
                  </div>
                  <div className="text-sm text-green-600">✓ 已付款</div>
                </div>
              </div>

              <div className="space-y-2">
                {record.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center p-2 bg-white rounded"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-black">
                        {getMenuItemId(item.menu_item_id)}{" "}
                        {getMenuItemName(item.menu_item_id)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {item.quantity} × {(item.unit_price / 100).toFixed(2)}{" "}
                        Kr
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-black">
                        {(item.price / 100).toFixed(2)} Kr
                      </div>
                      {item.is_paid && (
                        <div className="text-xs text-green-600">✓ 已付款</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
