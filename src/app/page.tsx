"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBusy(true);
      setError(null);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace("/tables");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBusy(true);
      setError(null);
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      alert("注册成功！请检查邮箱验证邮件，然后登录。");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm border rounded p-6 space-y-4">
        <h1 className="text-xl font-semibold text-center">登录</h1>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        
        <form onSubmit={onLogin} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-600">邮箱</label>
            <input
              type="email"
              className="border rounded px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-600">密码</label>
            <input
              type="password"
              className="border rounded px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded bg-black text-white px-4 py-2 disabled:opacity-50"
          >
            登录
          </button>
        </form>
        
        <div className="text-center text-sm text-gray-500">或</div>
        
        <button
          onClick={onRegister}
          disabled={busy}
          className="w-full rounded border border-gray-300 text-gray-700 px-4 py-2 disabled:opacity-50 hover:bg-gray-50"
        >
          注册新用户
        </button>
      </div>
    </div>
  );
}
