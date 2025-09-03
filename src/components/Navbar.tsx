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

  return (
         <header className="border-b sticky top-0 z-40 bg-black text-white">
       <nav className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
         <div className="flex items-center gap-2 order-1">
           <button onClick={() => router.back()} className="border border-white/20 rounded px-3 py-1 text-sm hover:bg-white/10">
             返回
           </button>
         </div>
         <div className="flex items-center gap-3 order-3 w-full sm:w-auto">
           <Link href="/tables" className={`border border-white/20 rounded px-3 py-1 text-sm ${pathname === "/tables" ? "bg-white text-black" : "hover:bg-white/10"}`}>
             桌台
           </Link>
           <Link href="/settings" className={`border border-white/20 rounded px-3 py-1 text-sm ${pathname?.startsWith("/settings") ? "bg-white text-black" : "hover:bg-white/10"}`}>
             设置
           </Link>
           <Link href="/history" className={`border border-white/20 rounded px-3 py-1 text-sm ${pathname === "/history" ? "bg-white text-black" : "hover:bg-white/10"}`}>
             历史记录
           </Link>
           <button onClick={logout} disabled={busy} className="border border-white/20 rounded px-3 py-1 text-sm disabled:opacity-50 hover:bg-white/10">
             退出登录
           </button>
         </div>
       </nav>
     </header>
  );
}


