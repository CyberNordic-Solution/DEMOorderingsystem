"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Order = {
  id: string;
  table_id: string;
  note: string | null;
  status: string;
  created_at: string;
};

type OrderItem = {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  price: number;
  is_paid: boolean;
};

type MenuItem = {
  id: string;
  menu_id?: string;
  name: string;
  price: number;
};

type Table = {
  id: string;
  name: string;
};

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [table, setTable] = useState<Table | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  const loadOrderData = async (id: string) => {
    try {
      // 加载订单信息
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .single();

      if (orderError) throw orderError;
      setOrder(orderData);

      // 加载餐桌信息
      if (orderData.table_id) {
        const { data: tableData } = await supabase
          .from("tables")
          .select("id, name")
          .eq("id", orderData.table_id)
          .single();
        setTable(tableData);
      }

      // 加载订单项目
      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", id);

      if (itemsError) throw itemsError;
      setOrderItems(itemsData || []);

      // 加载菜品信息
      if (itemsData && itemsData.length > 0) {
        const menuItemIds = itemsData.map((item) => item.menu_item_id);
        const { data: menuData } = await supabase
          .from("menu_items")
          .select("id, menu_id, name, price")
          .in("id", menuItemIds);
        setMenuItems(menuData || []);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const getParams = async () => {
      const resolvedParams = await params;
      setOrderId(resolvedParams.orderId);
      if (resolvedParams.orderId) {
        loadOrderData(resolvedParams.orderId);
      }
    };
    getParams();
  }, [params]);

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

  const paidAmount = orderItems.reduce((sum, item) => {
    return sum + (item.is_paid ? item.price : 0);
  }, 0);

  if (loading) return <div className="p-6">加载中...</div>;
  if (error) return <div className="p-6 text-red-600">错误: {error}</div>;
  if (!order) return <div className="p-6">订单不存在</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* 订单头部 */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold mb-3">
                  {order.note || `订单 #${order.id}`}
                </h1>
                <div className="space-y-1 text-blue-100">
                  <p className="flex items-center">
                    <span className="mr-2">🏠</span>
                    餐桌: {table?.name || "未知餐桌"}
                  </p>
                  <p className="flex items-center">
                    <span className="mr-2">🕒</span>
                    创建时间: {new Date(order.created_at).toLocaleString()}
                  </p>
                  <p className="flex items-center">
                    <span className="mr-2">📊</span>
                    状态:{" "}
                    {order.status === "pending"
                      ? "待处理"
                      : order.status === "completed"
                        ? "已完成"
                        : order.status === "cancelled"
                          ? "已取消"
                          : order.status}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold mb-2">
                  {(totalAmount / 100).toFixed(2)} Kr
                </div>
                {paidAmount > 0 && (
                  <div className="text-blue-100">
                    已付: {(paidAmount / 100).toFixed(2)} Kr
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 菜品列表 */}
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">菜品明细</h2>
            <div className="space-y-4">
              {orderItems.map((item, index) => (
                <div
                  key={item.id}
                  className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <span className="text-gray-500 text-sm mr-3">
                          #{index + 1}
                        </span>
                        <div className="font-semibold text-lg text-gray-800">
                          {getMenuItemId(item.menu_item_id)}{" "}
                          {getMenuItemName(item.menu_item_id)}
                        </div>
                      </div>
                      <div className="text-gray-600 ml-8">
                        单价: {(item.unit_price / 100).toFixed(2)} Kr
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-600 mb-1">
                        {item.quantity} × {(item.unit_price / 100).toFixed(2)}{" "}
                        Kr
                      </div>
                      <div className="text-xl font-bold text-green-600">
                        {(item.price / 100).toFixed(2)} Kr
                      </div>
                      {item.is_paid && (
                        <div className="text-xs text-green-600 mt-1">
                          ✓ 已付款
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 总计 */}
            <div className="mt-8 pt-6 border-t-2 border-gray-200">
              <div className="flex justify-between items-center bg-green-50 rounded-lg p-4">
                <div className="text-xl font-bold text-gray-800">总计</div>
                <div className="text-3xl font-bold text-green-600">
                  {(totalAmount / 100).toFixed(2)} Kr
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-4 mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={() => window.print()}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                🖨️ 打印订单
              </button>
              <button
                onClick={() => window.close()}
                className="flex-1 bg-gray-200 text-gray-800 py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                ❌ 关闭
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
