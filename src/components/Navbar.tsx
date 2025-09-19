"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useState } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const logout = async () => {
    try {
      setBusy(true);
      await supabase.auth.signOut();
      router.replace("/");
    } finally {
      setBusy(false);
    }
  };

  if (pathname === "/") return null;

  const itemBase =
    "border border-white/20 rounded px-3 py-1 text-sm hover:bg-white/10 transition";

  const isActive = (p: string | RegExp) =>
    typeof p === "string" ? pathname === p : p.test(pathname ?? "");

  return (
    <header className="sticky top-0 z-40 border-b bg-black text-white">
      {/* 改为 w-full，让左右两侧真正贴边，保证“返回”与右侧按钮对齐到两端 */}
      <nav className="w-full px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          {/* 左侧：返回 */}
          <div className="flex items-center">
            <button
              onClick={() => router.back()}
              className={`${itemBase} ml-0`}
              aria-label="返回上一页"
            >
              返回
            </button>
          </div>

          {/* 右侧：导航与退出 */}
          <div className="flex items-center gap-1 sm:gap-3 overflow-x-auto">
            <Link
              href="/tables"
              className={`${itemBase} ${isActive("/tables") ? "bg-white text-black" : ""} whitespace-nowrap flex-shrink-0`}
            >
              桌台
            </Link>
            <Link
              href="/settings"
              className={`${itemBase} ${isActive(/^\/settings/) ? "bg-white text-black" : ""} whitespace-nowrap flex-shrink-0`}
            >
              设置
            </Link>
            <Link
              href="/history"
              className={`${itemBase} ${isActive("/history") ? "bg-white text-black" : ""} whitespace-nowrap flex-shrink-0`}
            >
              支付记录
            </Link>
            <button
              onClick={logout}
              disabled={busy}
              className={`${itemBase} disabled:opacity-50 whitespace-nowrap flex-shrink-0`}
            >
              退出登录
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
}
