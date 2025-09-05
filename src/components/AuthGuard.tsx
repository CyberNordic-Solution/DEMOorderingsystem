"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { User } from "@supabase/supabase-js";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 检查当前用户
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);

      // 只有在非登录页面且未登录时才重定向
      if (!user && pathname !== "/") {
        router.replace("/");
      }
    };

    checkUser();

    // 监听认证状态变化（但不自动登出）
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session.user) {
        setUser(session.user);
      }
      // 移除自动登出逻辑，让用户手动控制登出
    });

    return () => subscription.unsubscribe();
  }, [router, pathname]);

  // 如果是登录页面，直接显示children（Navbar）
  if (pathname === "/") {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">检查登录状态...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // 会重定向到登录页面
  }

  return <>{children}</>;
}
