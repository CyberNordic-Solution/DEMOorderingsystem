"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppSettings } from "@/lib/types";

type GeneralSettings = Pick<
  AppSettings,
  | "restaurant_name"
  | "restaurant_address"
  | "restaurant_phone"
  | "restaurant_email"
  | "currency"
  | "tax_rate_dine_in"
  | "tax_rate_takeaway"
  | "service_charge"
  | "business_hours"
>;

export default function GeneralSettingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<GeneralSettings>({
    restaurant_name: "餐厅",
    restaurant_address: "",
    restaurant_phone: "",
    restaurant_email: "",
    currency: "Kr",
    tax_rate_dine_in: 0,
    tax_rate_takeaway: 0,
    service_charge: 0,
    business_hours: {
      monday: { open: "09:00", close: "22:00", closed: false },
      tuesday: { open: "09:00", close: "22:00", closed: false },
      wednesday: { open: "09:00", close: "22:00", closed: false },
      thursday: { open: "09:00", close: "22:00", closed: false },
      friday: { open: "09:00", close: "23:00", closed: false },
      saturday: { open: "10:00", close: "23:00", closed: false },
      sunday: { open: "10:00", close: "22:00", closed: false },
    },
  });

  const load = useCallback(async () => {
    try {
      // 先获取所有记录，看看有多少条
      const { data: allData, error: allError } = await supabase
        .from("app_settings")
        .select(
          "id, restaurant_name, restaurant_address, restaurant_phone, restaurant_email, currency, tax_rate_dine_in, tax_rate_takeaway, service_charge, business_hours, updated_at",
        )
        .order("updated_at", { ascending: false });

      console.log("所有app_settings记录:", allData);
      if (allData && allData.length > 0) {
        console.log("记录数量:", allData.length);
        allData.forEach((record, index) => {
          console.log(`记录 ${index + 1}:`, {
            id: record.id,
            restaurant_name: record.restaurant_name,
            updated_at: record.updated_at,
            tax_rate_dine_in: record.tax_rate_dine_in,
            tax_rate_takeaway: record.tax_rate_takeaway,
          });
        });
      }

      if (allError) throw allError;

      // 使用最新的记录（updated_at最大的）
      const data = allData && allData.length > 0 ? allData[0] : null;

      if (data) {
        const defaultBusinessHours = {
          monday: { open: "09:00", close: "22:00", closed: false },
          tuesday: { open: "09:00", close: "22:00", closed: false },
          wednesday: { open: "09:00", close: "22:00", closed: false },
          thursday: { open: "09:00", close: "22:00", closed: false },
          friday: { open: "09:00", close: "23:00", closed: false },
          saturday: { open: "10:00", close: "23:00", closed: false },
          sunday: { open: "10:00", close: "22:00", closed: false },
        };

        console.log("使用记录:", data);

        setSettings((prev) => ({
          restaurant_name: data.restaurant_name || "餐厅",
          restaurant_address: data.restaurant_address || "",
          restaurant_phone: data.restaurant_phone || "",
          restaurant_email: data.restaurant_email || "",
          currency: data.currency || "Kr",
          tax_rate_dine_in: data.tax_rate_dine_in || 0,
          tax_rate_takeaway: data.tax_rate_takeaway || 0,
          service_charge:
            data.service_charge !== null && data.service_charge !== undefined
              ? data.service_charge
              : prev.service_charge,
          business_hours: data.business_hours
            ? data.business_hours
            : prev.business_hours,
        }));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, []);

  // 监听路径变化，当回到这个页面时刷新数据
  useEffect(() => {
    if (pathname === "/settings/general" && !loading && !saving) {
      console.log("检测到路径变化，刷新数据");
      const timer = setTimeout(() => {
        load();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [pathname, load, loading, saving]);

  // 添加路由变化监听器
  useEffect(() => {
    const handleRouteChange = () => {
      console.log("路由变化，重新加载数据");
      // 延迟一点时间确保页面完全加载
      setTimeout(() => {
        if (!loading && !saving) {
          load();
        }
      }, 100);
    };

    // 监听页面加载完成
    window.addEventListener("load", handleRouteChange);

    // 监听 popstate 事件（浏览器前进后退）
    window.addEventListener("popstate", handleRouteChange);

    return () => {
      window.removeEventListener("load", handleRouteChange);
      window.removeEventListener("popstate", handleRouteChange);
    };
  }, [load, loading, saving]);

  // 添加页面焦点和可见性变化监听器，自动刷新数据
  useEffect(() => {
    const handleFocus = async () => {
      console.log("页面获得焦点，开始刷新数据");
      if (!loading && !saving) {
        setRefreshing(true);
        try {
          const { data: allData, error } = await supabase
            .from("app_settings")
            .select(
              "id, restaurant_name, restaurant_address, restaurant_phone, restaurant_email, currency, tax_rate_dine_in, tax_rate_takeaway, service_charge, business_hours, updated_at",
            )
            .order("updated_at", { ascending: false });

          if (error) throw error;

          // 使用最新的记录
          const data = allData && allData.length > 0 ? allData[0] : null;

          if (data) {
            const defaultBusinessHours = {
              monday: { open: "09:00", close: "22:00", closed: false },
              tuesday: { open: "09:00", close: "22:00", closed: false },
              wednesday: { open: "09:00", close: "22:00", closed: false },
              thursday: { open: "09:00", close: "22:00", closed: false },
              friday: { open: "09:00", close: "23:00", closed: false },
              saturday: { open: "10:00", close: "23:00", closed: false },
              sunday: { open: "10:00", close: "22:00", closed: false },
            };

            setSettings((prev) => ({
              restaurant_name: data.restaurant_name || "餐厅",
              restaurant_address: data.restaurant_address || "",
              restaurant_phone: data.restaurant_phone || "",
              restaurant_email: data.restaurant_email || "",
              currency: data.currency || "Kr",
              tax_rate_dine_in: data.tax_rate_dine_in || 0,
              tax_rate_takeaway: data.tax_rate_takeaway || 0,
              service_charge:
                data.service_charge !== null &&
                data.service_charge !== undefined
                  ? data.service_charge
                  : prev.service_charge,
              business_hours: data.business_hours
                ? data.business_hours
                : prev.business_hours,
            }));
            console.log("焦点刷新完成，使用数据:", data.restaurant_name);
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
        } finally {
          setRefreshing(false);
        }
      }
    };

    const handleVisibilityChange = async () => {
      console.log("页面可见性变化，hidden:", document.hidden);
      if (!document.hidden && !loading && !saving) {
        setRefreshing(true);
        try {
          const { data: allData, error } = await supabase
            .from("app_settings")
            .select(
              "id, restaurant_name, restaurant_address, restaurant_phone, restaurant_email, currency, tax_rate_dine_in, tax_rate_takeaway, service_charge, business_hours, updated_at",
            )
            .order("updated_at", { ascending: false });

          if (error) throw error;

          // 使用最新的记录
          const data = allData && allData.length > 0 ? allData[0] : null;

          if (data) {
            const defaultBusinessHours = {
              monday: { open: "09:00", close: "22:00", closed: false },
              tuesday: { open: "09:00", close: "22:00", closed: false },
              wednesday: { open: "09:00", close: "22:00", closed: false },
              thursday: { open: "09:00", close: "22:00", closed: false },
              friday: { open: "09:00", close: "23:00", closed: false },
              saturday: { open: "10:00", close: "23:00", closed: false },
              sunday: { open: "10:00", close: "22:00", closed: false },
            };

            setSettings((prev) => ({
              restaurant_name: data.restaurant_name || "餐厅",
              restaurant_address: data.restaurant_address || "",
              restaurant_phone: data.restaurant_phone || "",
              restaurant_email: data.restaurant_email || "",
              currency: data.currency || "Kr",
              tax_rate_dine_in: data.tax_rate_dine_in || 0,
              tax_rate_takeaway: data.tax_rate_takeaway || 0,
              service_charge:
                data.service_charge !== null &&
                data.service_charge !== undefined
                  ? data.service_charge
                  : prev.service_charge,
              business_hours: data.business_hours
                ? data.business_hours
                : prev.business_hours,
            }));
            console.log("可见性刷新完成，使用数据:", data.restaurant_name);
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
        } finally {
          setRefreshing(false);
        }
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loading, saving]);

  const save = async () => {
    // 显示警告信息
    const confirmed = window.confirm(
      "⚠️ 警告：请确认以下设置的准确性！\n\n" +
        "• 服务费设置将影响所有价格计算\n" +
        "• 营业时间将影响系统运营\n\n" +
        "注意：只有服务费和营业时间会被保存，其他设置（餐厅信息、税率等）为只读。\n\n" +
        "您负责所有信息的正确性。确认保存吗？",
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError(null);

      const { data: currentSetting } = await supabase
        .from("app_settings")
        .select("id")
        .limit(1)
        .single();

      if (!currentSetting) {
        console.log("创建新记录，保存内容:", {
          service_charge: settings.service_charge,
          business_hours: settings.business_hours,
        });
        const { error: insErr } = await supabase.from("app_settings").insert({
          service_charge: settings.service_charge,
          business_hours: settings.business_hours,
        });
        if (insErr) throw insErr;
      } else {
        const { error: updErr } = await supabase
          .from("app_settings")
          .update({
            service_charge: settings.service_charge,
            business_hours: settings.business_hours,
          })
          .eq("id", currentSetting.id);
        if (updErr) throw updErr;
      }

      setError(null);
      setSuccessMessage("设置已保存：服务费和营业时间已更新");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const updateBusinessHours = (
    day: string,
    field: "open" | "close" | "closed",
    value: string | boolean,
  ) => {
    setSettings((prev) => ({
      ...prev,
      business_hours: {
        ...prev.business_hours,
        [day]: {
          ...prev.business_hours[day as keyof typeof prev.business_hours],
          [field]: value,
        },
      },
    }));
  };

  if (loading) return <div className="p-6">加载中...</div>;

  const days = [
    { key: "monday", label: "周一" },
    { key: "tuesday", label: "周二" },
    { key: "wednesday", label: "周三" },
    { key: "thursday", label: "周四" },
    { key: "friday", label: "周五" },
    { key: "saturday", label: "周六" },
    { key: "sunday", label: "周日" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">通用设置</h1>
        <button
          onClick={async () => {
            setRefreshing(true);
            try {
              // 强制刷新，不使用缓存
              const { data: allData, error } = await supabase
                .from("app_settings")
                .select(
                  "id, restaurant_name, restaurant_address, restaurant_phone, restaurant_email, currency, tax_rate_dine_in, tax_rate_takeaway, service_charge, business_hours, updated_at",
                )
                .order("updated_at", { ascending: false });

              if (error) throw error;

              console.log("刷新时所有记录:", allData);

              // 使用最新的记录
              const data = allData && allData.length > 0 ? allData[0] : null;

              if (data) {
                const defaultBusinessHours = {
                  monday: { open: "09:00", close: "22:00", closed: false },
                  tuesday: { open: "09:00", close: "22:00", closed: false },
                  wednesday: { open: "09:00", close: "22:00", closed: false },
                  thursday: { open: "09:00", close: "22:00", closed: false },
                  friday: { open: "09:00", close: "23:00", closed: false },
                  saturday: { open: "10:00", close: "23:00", closed: false },
                  sunday: { open: "10:00", close: "22:00", closed: false },
                };

                setSettings((prev) => ({
                  restaurant_name: data.restaurant_name || "餐厅",
                  restaurant_address: data.restaurant_address || "",
                  restaurant_phone: data.restaurant_phone || "",
                  restaurant_email: data.restaurant_email || "",
                  currency: data.currency || "Kr",
                  tax_rate_dine_in: data.tax_rate_dine_in || 0,
                  tax_rate_takeaway: data.tax_rate_takeaway || 0,
                  service_charge:
                    data.service_charge !== null &&
                    data.service_charge !== undefined
                      ? data.service_charge
                      : prev.service_charge,
                  business_hours: data.business_hours
                    ? data.business_hours
                    : prev.business_hours,
                }));
                console.log("刷新数据:", data);
                setSuccessMessage(
                  `数据已刷新 - 餐厅名称: ${data.restaurant_name || "餐厅"}`,
                );
                setTimeout(() => setSuccessMessage(null), 3000);
              }
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : String(err);
              setError(message);
            } finally {
              setRefreshing(false);
            }
          }}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
        >
          {refreshing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-600 border-t-transparent"></div>
              刷新中...
            </>
          ) : (
            <>🔄 刷新</>
          )}
        </button>
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {successMessage && (
        <div className="text-green-600 text-sm">{successMessage}</div>
      )}

      {/* 餐厅信息 */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-gray-800">餐厅信息</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              餐厅名称
            </label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
              value={settings.restaurant_name}
              readOnly
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              联系电话
            </label>
            <input
              type="tel"
              className="w-full border rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
              value={settings.restaurant_phone}
              readOnly
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              邮箱地址
            </label>
            <input
              type="email"
              className="w-full border rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
              value={settings.restaurant_email}
              readOnly
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              餐厅地址
            </label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
              value={settings.restaurant_address}
              readOnly
              disabled
            />
          </div>
        </div>
      </div>

      {/* 财务设置 */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-gray-800">财务设置</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              货币单位
            </label>
            <select
              className="w-full border rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
              value={settings.currency}
              disabled
            >
              <option value="Kr">Kr</option>
              <option value="¥">¥</option>
              <option value="$">$</option>
              <option value="€">€</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              堂食税率 (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="w-full border rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
              value={settings.tax_rate_dine_in}
              readOnly
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              外卖税率 (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="w-full border rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
              value={settings.tax_rate_takeaway}
              readOnly
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              服务费 (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="w-full border rounded px-3 py-2"
              value={settings.service_charge}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  service_charge: Number(e.target.value),
                }))
              }
            />
          </div>
        </div>
      </div>

      {/* 营业时间 */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-gray-800">营业时间</h2>
        <div className="space-y-3">
          {days.map((day) => {
            const dayHours =
              settings.business_hours[
                day.key as keyof typeof settings.business_hours
              ];
            return (
              <div key={day.key} className="flex items-center gap-4">
                <div className="w-16 text-sm font-medium text-gray-700">
                  {day.label}
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={!dayHours.closed}
                    onChange={(e) =>
                      updateBusinessHours(day.key, "closed", !e.target.checked)
                    }
                  />
                  <span className="text-sm text-gray-600">营业</span>
                </label>
                {!dayHours.closed && (
                  <>
                    <input
                      type="time"
                      className="border rounded px-3 py-1"
                      value={dayHours.open}
                      onChange={(e) =>
                        updateBusinessHours(day.key, "open", e.target.value)
                      }
                    />
                    <span className="text-gray-500">至</span>
                    <input
                      type="time"
                      className="border rounded px-3 py-1"
                      value={dayHours.close}
                      onChange={(e) =>
                        updateBusinessHours(day.key, "close", e.target.value)
                      }
                    />
                  </>
                )}
                {dayHours.closed && (
                  <span className="text-red-500 text-sm">休息</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 保存按钮 */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={save}
          disabled={saving}
          className="rounded bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-2 disabled:opacity-50 hover:from-green-700 hover:to-green-800 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:scale-100"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              保存中...
            </span>
          ) : (
            <span className="flex items-center gap-2">💾 保存设置</span>
          )}
        </button>
        <button
          onClick={() => router.back()}
          className="rounded border px-4 py-2 hover:bg-gray-50 transition-colors"
        >
          返回
        </button>
      </div>
    </div>
  );
}
