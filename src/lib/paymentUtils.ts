import { supabase } from "./supabaseClient";

export interface UpdateOrderParams {
  orderId: string;
  status?: string;
  note?: string;
  closed_at?: string;
  completed_at?: string;
}

export async function updateOrder(params: UpdateOrderParams): Promise<void> {
  try {
    const updateData: any = {};

    if (params.status !== undefined) updateData.status = params.status;
    if (params.note !== undefined) updateData.note = params.note;
    if (params.closed_at !== undefined) updateData.closed_at = params.closed_at;
    if (params.completed_at !== undefined)
      updateData.completed_at = params.completed_at;

    const { error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", params.orderId);

    if (error) throw error;
  } catch (error) {
    console.error("更新订单失败:", error);
    throw error;
  }
}

export async function getOrderWithItems(orderId: string) {
  try {
    // 获取订单信息
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError) throw orderError;

    // 获取订单项目
    const { data: orderItemsData, error: orderItemsError } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    if (orderItemsError) throw orderItemsError;

    return {
      order: orderData,
      orderItems: orderItemsData || [],
    };
  } catch (error) {
    console.error("获取订单信息失败:", error);
    throw error;
  }
}

export function formatCurrency(amount: number): string {
  return (amount / 100).toFixed(2);
}

export function calculateTax(subtotal: number, taxRate: number): number {
  return Math.round((subtotal * taxRate) / 100);
}

export function calculateServiceCharge(
  subtotal: number,
  serviceChargeRate: number,
): number {
  return Math.round((subtotal * serviceChargeRate) / 100);
}
