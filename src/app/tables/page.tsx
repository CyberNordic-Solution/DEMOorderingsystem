"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Table = { id: string; index_no: number; name: string; is_active: boolean };
type Order = { id: string; table_id: string; status: string; note: string | null; created_at: string };
type Category = { id: string; name: string; sort_order: number; is_active: boolean };
type MenuItem = { id: string; menu_id?: string; name: string; price: number; category_id: string | null; is_active: boolean };
type OrderItem = { id: string; order_id: string; menu_item_id: string; quantity: number; unit_price: number; price: number; is_paid?: boolean };

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [ordersByTable, setOrdersByTable] = useState<Record<string, Order[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [showBulkPaymentModal, setShowBulkPaymentModal] = useState(false);

  const load = async () => {
    const [{ data: ts }, { data: os }] = await Promise.all([
      supabase.from("tables").select("id, index_no, name, is_active").order("index_no"),
      supabase.from("orders").select("id, table_id, status, note, created_at").order("created_at", { ascending: false }),
    ]);
    setTables((ts as Table[]) || []);
    const map: Record<string, Order[]> = {};
    (os as Order[] | null)?.forEach((o) => {
      // 只显示未完成的订单
      if (o.status !== 'completed') {
        map[o.table_id] = map[o.table_id] || [];
        map[o.table_id].push(o);
      }
    });
    setOrdersByTable(map);
  };

  const loadMenuData = async () => {
    const [{ data: cats }, { data: items }] = await Promise.all([
      supabase.from("menu_categories").select("id, name, sort_order, is_active").order("sort_order"),
      supabase.from("menu_items").select("id, menu_id, name, price, category_id, is_active").order("id"),
    ]);
    setCategories((cats as Category[]) || []);
    setMenuItems((items as MenuItem[]) || []);
    if (cats && cats.length > 0) setActiveCategory((cats[0] as Category).id);
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
    
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
    setSelectedOrders(new Set(tableOrders.map(order => order.id)));
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

      const createOrderWithItems = async (selectedItems: { itemId: string; quantity: number }[]) => {
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
            status: "pending"
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
        const menuItem = menuItems.find(item => item.id === itemId);
        return {
          order_id: orderId,
          menu_item_id: itemId,
          quantity,
          unit_price: menuItem?.price || 0,
          price: (menuItem?.price || 0) * quantity
        };
      });
      
      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
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
      
      setSelectedOrder(orderData);
      setSelectedTableId(orderData.table_id); // 设置餐桌ID，用于加菜
      setOrderItems(itemsData || []);
      setShowOrderModal(true);
    } catch (error) {
      console.error("加载订单详情失败:", error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">餐桌</h1>
        <button 
          onClick={() => load().catch((e) => setError(String(e?.message || e)))}
          className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded hover:from-green-600 hover:to-green-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:scale-105"
        >
          🔄 刷新
        </button>
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {tables.map((t) => (
          <div key={t.id} className="border rounded p-3 space-y-2">
            <div className="flex justify-between items-center">
              <div className="font-medium">{t.name}</div>
              <div className="text-xs text-gray-500">
                {(ordersByTable[t.id] || []).length} 个订单
              </div>
            </div>
            
            {/* 批量操作按钮 */}
            {(ordersByTable[t.id] || []).length > 0 && (
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => selectAllOrders(t.id)}
                  className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  全选
                </button>
                <button
                  onClick={clearOrderSelection}
                  className="px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  清除
                </button>
                {selectedOrders.size > 0 && (
                  <button
                    onClick={handleBulkPayment}
                    className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    批量付款 ({selectedOrders.size})
                  </button>
                )}
              </div>
            )}
            
            <div className="space-y-2">
              {(ordersByTable[t.id] || []).map((o) => (
                <div 
                  key={o.id} 
                  className={`border rounded p-2 text-sm flex items-center justify-between ${
                    selectedOrders.has(o.id) ? 'bg-blue-50 border-blue-300' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center flex-1">
                    <input
                      type="checkbox"
                      checked={selectedOrders.has(o.id)}
                      onChange={() => toggleOrderSelection(o.id)}
                      className="mr-2"
                    />
                                         <div className="flex-1">
                       <div className="truncate font-medium text-black">{o.note || `订单 #${o.id}`}</div>
                       <div className="text-xs text-gray-500">
                         状态: {o.status === 'pending' ? '待处理' : o.status === 'completed' ? '已完成' : o.status === 'cancelled' ? '已取消' : o.status}
                         {o.created_at && ` | ${new Date(o.created_at).toLocaleTimeString()}`}
                       </div>
                     </div>
                  </div>
                  <button 
                    onClick={() => viewOrder(o.id)}
                    className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                  >
                    查看
                  </button>
                </div>
              ))}
              {(ordersByTable[t.id] || []).length === 0 && (
                <div className="text-center text-gray-400 text-sm py-2">
                  暂无订单
                </div>
              )}
            </div>
            
            <button className="border rounded px-3 py-1" onClick={() => addBill(t.id)}>
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
           onAddItems={() => {
             setShowOrderModal(false);
             setShowMenuModal(true);
             // 确保 selectedOrder 已经设置，这样加菜时会添加到正确的订单
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
  onClose
}: {
  selectedOrderIds: string[];
  ordersByTable: Record<string, Order[]>;
  onClose: () => void;
}) {
  const [allOrderItems, setAllOrderItems] = useState<OrderItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [paymentType, setPaymentType] = useState<'full' | 'partial'>('full');

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
          .select("id, menu_id, name, price");
        
        setAllOrderItems(itemsData || []);
        setMenuItems(menuData || []);
      } catch (error) {
        console.error("加载批量付款数据失败:", error);
      }
    };

    loadBulkPaymentData();
  }, [selectedOrderIds]);

  const getMenuItemName = (menuItemId: string) => {
    const item = menuItems.find(item => item.id === menuItemId);
    return item?.name || '未知菜品';
  };

  const getMenuItemId = (menuItemId: string) => {
    const item = menuItems.find(item => item.id === menuItemId);
    return item?.menu_id ? `#${item.menu_id}` : `#${String(item?.id || '').slice(-6)}`;
  };

  const getOrderInfo = (orderId: string) => {
    for (const tableOrders of Object.values(ordersByTable)) {
      const order = tableOrders.find(o => o.id === orderId);
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
    setSelectedItems(new Set(allOrderItems.map(item => item.id)));
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  const handlePayment = async () => {
    try {
      if (paymentType === 'full') {
        // 全买单 - 更新所有选中订单的状态
        const { error } = await supabase
          .from("orders")
          .update({ 
            status: "completed",
            completed_at: new Date().toISOString()
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
      <div className="bg-white rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-black">
            批量付款 - {selectedOrderIds.length} 个订单
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
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
                      状态: {order?.status === 'pending' ? '待处理' : order?.status === 'completed' ? '已完成' : order?.status}
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
              <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center flex-1">
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={() => toggleItemSelection(item.id)}
                    className="mr-3"
                    disabled={paymentType === 'full'}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-black">
                      {getMenuItemId(item.menu_item_id)} {getMenuItemName(item.menu_item_id)}
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
                {paymentType === 'partial' ? '选中项目总计' : '所有订单总计'}
              </div>
              <div className="text-2xl font-bold text-green-600">
                {(paymentType === 'partial' ? selectedAmount : totalAmount / 100).toFixed(2)} Kr
              </div>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="mt-4 pt-4 border-t space-y-3">
          {/* 买单方式选择 */}
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="bulkPaymentType"
                value="full"
                checked={paymentType === 'full'}
                onChange={(e) => setPaymentType(e.target.value as 'full' | 'partial')}
                className="mr-2"
              />
              <span className="text-black">全买单</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="bulkPaymentType"
                value="partial"
                checked={paymentType === 'partial'}
                onChange={(e) => setPaymentType(e.target.value as 'full' | 'partial')}
                className="mr-2"
              />
              <span className="text-black">选择买单</span>
            </label>
          </div>

          {/* 部分买单时的选择按钮 */}
          {paymentType === 'partial' && (
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
  onAddItems
}: {
  order: Order;
  orderItems: OrderItem[];
  menuItems: MenuItem[];
  onClose: () => void;
  onAddItems: () => void;
}) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [paymentType, setPaymentType] = useState<'full' | 'partial'>('full');

  const getMenuItemName = (menuItemId: string) => {
    const item = menuItems.find(item => item.id === menuItemId);
    return item?.name || '未知菜品';
  };

  const getMenuItemId = (menuItemId: string) => {
    const item = menuItems.find(item => item.id === menuItemId);
    return item?.menu_id ? `#${item.menu_id}` : `#${String(item?.id || '').slice(-6)}`;
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
    setSelectedItems(new Set(orderItems.map(item => item.id)));
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  const handlePayment = async () => {
    try {
      if (paymentType === 'full') {
        // 全买单
        const { error } = await supabase
          .from("orders")
          .update({ 
            status: "completed",
            completed_at: new Date().toISOString()
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
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-black">订单详情 - {order.note || `订单 #${order.id}`}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* 订单信息 */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="text-sm text-gray-600">
              状态: {order.status === 'pending' ? '待处理' : order.status === 'completed' ? '已完成' : order.status}
              <br />
              创建时间: {new Date(order.created_at).toLocaleString()}
            </div>
          </div>

          {/* 菜品列表 */}
          <div className="space-y-2">
            {orderItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center flex-1">
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={() => toggleItemSelection(item.id)}
                    className="mr-3"
                    disabled={paymentType === 'full'}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-black">
                      {getMenuItemId(item.menu_item_id)} {getMenuItemName(item.menu_item_id)}
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
                {paymentType === 'partial' ? '选中项目总计' : '订单总计'}
              </div>
              <div className="text-2xl font-bold text-green-600">
                {(paymentType === 'partial' ? selectedAmount : totalAmount / 100).toFixed(2)} Kr
              </div>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="mt-4 pt-4 border-t space-y-3">
          {/* 买单方式选择 */}
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="paymentType"
                value="full"
                checked={paymentType === 'full'}
                onChange={(e) => setPaymentType(e.target.value as 'full' | 'partial')}
                className="mr-2"
              />
              <span className="text-black">全买单</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="paymentType"
                value="partial"
                checked={paymentType === 'partial'}
                onChange={(e) => setPaymentType(e.target.value as 'full' | 'partial')}
                className="mr-2"
              />
              <span className="text-black">选择买单</span>
            </label>
          </div>

          {/* 部分买单时的选择按钮 */}
          {paymentType === 'partial' && (
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
  isAddingItems = false
}: {
  categories: Category[];
  menuItems: MenuItem[];
  activeCategory: string | null;
  onCategoryChange: (categoryId: string) => void;
  onClose: () => void;
  onCreateOrder: (selectedItems: { itemId: string; quantity: number }[]) => void;
  isAddingItems?: boolean;
}) {
  const [selectedItems, setSelectedItems] = useState<{ itemId: string; quantity: number }[]>([]);

  const addItemToSelection = (itemId: string) => {
    const existing = selectedItems.find(item => item.itemId === itemId);
    if (existing) {
      setSelectedItems(selectedItems.map(item => 
        item.itemId === itemId 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setSelectedItems([...selectedItems, { itemId, quantity: 1 }]);
    }
  };

  const removeItemFromSelection = (itemId: string) => {
    setSelectedItems(selectedItems.filter(item => item.itemId !== itemId));
  };

  const updateItemQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItemFromSelection(itemId);
    } else {
      setSelectedItems(selectedItems.map(item => 
        item.itemId === itemId ? { ...item, quantity } : item
      ));
    }
  };

  const getItemName = (itemId: string) => {
    const item = menuItems.find(item => item.id === itemId);
    return item?.name || '';
  };

  const getItemPrice = (itemId: string) => {
    const item = menuItems.find(item => item.id === itemId);
    return item?.price || 0;
  };

  const totalAmount = selectedItems.reduce((sum, item) => {
    return sum + (getItemPrice(item.itemId) * item.quantity);
  }, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">选择菜品</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

                 <div className="flex-1 flex gap-4 overflow-hidden">
           {/* 左侧：菜单分类 */}
           <div className="w-64 flex flex-col">
             <h3 className="font-medium mb-3 text-black">菜单分类</h3>
             <div className="flex-1 overflow-y-auto space-y-2">
               {categories.map((cat) => (
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
           <div className="flex-1 flex flex-col">
             <h3 className="font-medium mb-3 text-black">菜品列表</h3>
             <div className="flex-1 overflow-y-auto space-y-2">
               {menuItems
                 .filter(item => item.category_id === activeCategory && item.is_active)
                 .map((item) => (
                   <div key={item.id} className="flex items-center justify-between p-3 border rounded">
                     <div className="flex-1">
                       <div className="font-medium text-black">
                         {item.menu_id ? `#${item.menu_id}` : `#${String(item.id).slice(-6)}`} {item.name}
                       </div>
                       <div className="text-sm text-black">{(item.price / 100).toFixed(2)} Kr</div>
                     </div>
                     <button
                       onClick={() => addItemToSelection(item.id)}
                       className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                     >
                       添加
                     </button>
                   </div>
                 ))}
             </div>
           </div>

           {/* 右侧：已选择的菜品 */}
           <div className="w-96 border-l pl-4">
             <h3 className="font-medium mb-3 text-black">已选择的菜品</h3>
             <div className="space-y-3 max-h-80 overflow-y-auto">
               {selectedItems.map((item) => (
                 <div key={item.itemId} className="flex items-center justify-between p-3 border rounded bg-gray-50">
                   <div className="flex-1">
                     <div className="text-base font-medium text-black">{getItemName(item.itemId)}</div>
                     <div className="text-sm text-black">
                       {(getItemPrice(item.itemId) / 100).toFixed(2)} Kr × {item.quantity}
                     </div>
                   </div>
                   <div className="flex items-center gap-2">
                     <button
                       onClick={() => updateItemQuantity(item.itemId, item.quantity - 1)}
                       className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center text-black hover:bg-gray-300"
                     >
                       -
                     </button>
                     <span className="w-10 text-center text-black font-medium">{item.quantity}</span>
                     <button
                       onClick={() => updateItemQuantity(item.itemId, item.quantity + 1)}
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
                  {isAddingItems ? `加菜 (${selectedItems.length} 项)` : `创建订单 (${selectedItems.length} 项)`}
                </button>
             </div>
           </div>
         </div>
      </div>
    </div>
  );
}

