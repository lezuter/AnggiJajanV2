"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("http://localhost:3001/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        // LOGIN SUKSES
        // alert("🎉 Login Berhasil: " + data.message); // Alert boleh diapus biar lebih smooth
        
        // --- [BAGIAN PENTING YANG HILANG TADI] ---
        // Simpan data biar Sidebar bisa baca
        localStorage.setItem("token", data.token);
        localStorage.setItem("user_name", data.user.name); // <--- INI KUNCINYA
        localStorage.setItem("user_role", data.user.role); // <--- INI JUGA
        // -----------------------------------------

        // Redirect ke dashboard
        router.push("/admin/dashboard");
      } else {
        alert("❌ Login Gagal: " + (data.error || "Cek email/password"));
      }

    } catch (error) {
      alert("⚠️ Error: Gak bisa konek ke Backend. Cek terminal backend nyala gak?");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-700">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Login Admin Panel</h1>
          <p className="text-gray-400 text-sm mt-2">Masukan akun Staff / Developer</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
            <input
              type="email" required
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 outline-none"
              placeholder=""
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
            <input
              type="password" required
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 outline-none"
              placeholder=""
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition duration-200"
          >
            {loading ? "Mengecek..." : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );
}