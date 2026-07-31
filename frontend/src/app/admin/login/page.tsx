"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"
).replace(/\/+$/, "");

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // 🛠️ NEW FUNCTIONAL STATE: STATUS SHIELD
  // States: 'idle', 'loading', 'success', 'error'
  const [shieldStatus, setShieldStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setShieldStatus("loading"); // <-- Set status loading

    try {
      const res = await fetch(`${API_BASE_URL}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user_name", data.user.name);
        localStorage.setItem("user_role", data.user.role);

        setShieldStatus("success"); // <-- Set status success

        // Kasih delay dikit biar status 'success' kelihatan dulu
        setTimeout(() => {
          router.push("/admin/dashboard/");
        }, 1200);
      } else {
        setShieldStatus("error"); // <-- Set status error
        alert("❌ Login Gagal: " + (data.error || "Cek email/password"));

        // Reset status error balik ke idle setelah alert ditutup/timeout
        setTimeout(() => setShieldStatus("idle"), 2000);
      }
    } catch (error) {
      setShieldStatus("error"); // <-- Set status error
      alert(
        "⚠️ Error: Gak bisa konek ke Backend. Cek terminal backend nyala gak?",
      );
      console.error(error);

      setTimeout(() => setShieldStatus("idle"), 2000);
    } finally {
      // setLoading(false) akan dipanggil di success timeout
      if (shieldStatus !== "success") {
        setLoading(false);
      }
    }
  };

  // 🛠️ FUNCTION TO RENDER DYNAMIC SHIELD STATUS
  const renderShieldStatus = () => {
    switch (shieldStatus) {
      case "loading":
        return (
          <span className="text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)] animate-pulse">
            ● Establishing Connection...
          </span>
        );
      case "success":
        return (
          <span className="text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]">
            ● Connection Established!
          </span>
        );
      case "error":
        return (
          <span className="text-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.5)]">
            ● Access Denied!
          </span>
        );
      case "idle":
      default:
        return (
          <span className="text-[#e491c9] drop-shadow-[0_0_6px_rgba(228,145,201,0.4)] hover:text-white transition-colors duration-300">
            ● Shield Active
          </span>
        );
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#15173d] overflow-hidden font-sans selection:bg-white selection:text-black">
      {/* ── HIGH-SPEC LIQUID CANVAS: BERRY WINE AURORA (REAL RANDOM GRADIENT) ── */}
      <style>{`
        @-webkit-keyframes liquidAurora {
          0% { background-position: 0% 50%, 100% 50%, 50% 100%, 0% 0%; }
          25% { background-position: 100% 30%, 0% 70%, 20% 40%, 80% 90%; }
          50% { background-position: 50% 100%, 100% 0%, 80% 20%, 10% 60%; }
          75% { background-position: 0% 40%, 30% 100%, 10% 80%, 100% 20%; }
          100% { background-position: 0% 50%, 100% 50%, 50% 100%, 0% 0%; }
        }
        @keyframes liquidAurora {
          0% { background-position: 0% 50%, 100% 50%, 50% 100%, 0% 0%; }
          25% { background-position: 100% 30%, 0% 70%, 20% 40%, 80% 90%; }
          50% { background-position: 50% 100%, 100% 0%, 80% 20%, 10% 60%; }
          75% { background-position: 0% 40%, 30% 100%, 10% 80%, 100% 20%; }
          100% { background-position: 0% 50%, 100% 50%, 50% 100%, 0% 0%; }
        }
        .animate-liquid-berry-canvas {
          background-image:
            radial-gradient(at 0% 0%, rgba(21, 23, 61, 0.85) 0px, transparent 55%),
            radial-gradient(at 100% 0%, rgba(152, 37, 152, 0.6) 0px, transparent 50%),
            radial-gradient(at 100% 100%, rgba(228, 145, 201, 0.55) 0px, transparent 50%),
            radial-gradient(at 0% 100%, rgba(241, 233, 233, 0.35) 0px, transparent 55%),
            radial-gradient(at 50% 50%, rgba(152, 37, 152, 0.45) 0px, transparent 60%);
          background-size: 200% 200%;
          -webkit-animation: liquidAurora 24s infinite ease-in-out;
          animation: liquidAurora 24s infinite ease-in-out;
        }
      `}</style>

      {/* LAYER DASAR: DEEP PURPLE INDIGO (#15173d) */}
      <div className="absolute inset-0 bg-[#15173d] z-0"></div>

      {/* LAYER 1: THE LIQUID BERRY CANVAS */}
      <div className="absolute inset-0 w-full h-full z-1 animate-liquid-berry-canvas blur-[45px] scale-105 pointer-events-none"></div>

      {/* Overlay tipis biar gradasi super halus */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#15173d]/50 via-transparent to-transparent z-2 pointer-events-none"></div>

      {/* ── LAYER 2: SPATIAL SHADOW ── */}
      <div className="absolute w-full max-w-md h-[400px] bg-black/60 rounded-[40px] blur-3xl transform translate-y-10 pointer-events-none z-3"></div>

      {/* ── LAYER 3: CRYSTAL CLEAR ACRYLIC CARD ── */}
      <div className="relative w-full max-w-md mx-4 z-10">
        <div className="bg-white/[0.015] backdrop-blur-[45px] border border-white/10 rounded-[40px] p-9 z-10 transition-all duration-500 ease-out shadow-[inset_0_4px_16px_rgba(255,255,255,0.15),inset_0_-4px_12px_rgba(0,0,0,0.6),0_20px_50px_-12px_rgba(0,0,0,0.6)] hover:border-white/25 hover:bg-white/[0.025] hover:shadow-[inset_0_6px_22px_rgba(255,255,255,0.28),inset_0_-4px_12px_rgba(0,0,0,0.6),0_35px_60px_-10px_rgba(0,0,0,0.7)]">
          {/* Header Area */}
          <div className="mb-8">
            <span className="text-[10px] font-bold text-purple-300/80 uppercase tracking-[0.25em] block mb-1">
              Secure Infrastructure
            </span>
            <h1 className="text-xl font-black tracking-tight text-white uppercase">
              ANGGI
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#e491c9] to-[#f1e9e9] drop-shadow-[0_0_15px_rgba(228,145,201,0.35)]">
                JAJAN
              </span>
            </h1>
            <div className="w-6 h-[2px] bg-white/30 mt-3"></div>
          </div>

          {/* Form Area */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Input Email */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Identity Token
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@anggijajan.com"
                disabled={loading}
                className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#e491c9] focus:bg-white/[0.05] transition-all duration-300 disabled:opacity-50"
                required
              />
            </div>

            {/* Input Password */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Access Key
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#e491c9] focus:bg-white/[0.05] transition-all duration-300 disabled:opacity-50"
                required
              />
            </div>

            {/* Button Pure White Premium */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-white hover:bg-slate-100 text-black text-xs font-bold uppercase tracking-[0.15em] py-4 px-4 rounded-2xl shadow-[0_4px_20px_rgba(255,255,255,0.15)] hover:shadow-[0_8px_30px_rgba(255,255,255,0.25)] transition-all duration-300 active:scale-[0.98] disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {loading ? "INITIALIZING..." : "Establish Connection"}
            </button>
          </form>

          {/* Footer Area with DYNAMIC SHIELD STATUS */}
          <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center text-[9px] text-slate-500 uppercase tracking-widest font-semibold">
            {/* Call the render function here */}
            {renderShieldStatus()}

            <span>Node: v2.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
