"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface Banner {
  ID: number;
  image_url: string;
  description: string;
}

export default function BannerCarousel() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [current, setCurrent] = useState(0);

  // 1. Fetch Banner Aktif dari API
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const res = await fetch("http://localhost:3001/api/banners");
        const data = await res.json();

        // Filter cuma yang ada gambarnya aja (jaga-jaga)
        const validBanners = (Array.isArray(data) ? data : [])
          .filter((b: any) => b.is_active !== false); // Asumsi backend balikin is_active, atau default true

        setBanners(validBanners);
      } catch (err) {
        console.error("Gagal load banner home:", err);
      }
    };
    fetchBanners();
  }, []);

  // 2. Auto Slide tiap 5 detik
  useEffect(() => {
    if (banners.length === 0) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev === banners.length - 1 ? 0 : prev + 1));
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  // Kalau gak ada banner, tampilin placeholder atau return null
  if (banners.length === 0) {
    return (
      <div className="w-full h-40 md:h-64 bg-gray-800 rounded-2xl animate-pulse flex items-center justify-center text-gray-600 text-sm">
        Memuat Promo...
      </div>
    );
  }

  return (
    <div className="relative w-full h-[180px] md:h-[350px] overflow-hidden rounded-2xl group shadow-2xl shadow-green-900/10 border border-gray-800/50">

      {/* SLIDES */}
      <div
        className="flex transition-transform duration-700 ease-in-out h-full"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {banners.map((banner) => (
          <div key={banner.ID} className="min-w-full h-full relative">
            <img
              src={banner.image_url}
              alt={banner.description || "Banner Promo"}
              className="w-full h-full object-cover"
              onError={(e) => (e.currentTarget.src = "/fallback-banner.jpg")} // Ganti kalo ada gambar default
            />
            {/* Gradient Overlay biar teks putih kebaca (opsional) */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
              <p className="text-white font-bold text-lg translate-y-4 group-hover:translate-y-0 transition-transform">
                {banner.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* DOTS INDICATOR */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {banners.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`h-2 rounded-full transition-all duration-300 shadow-sm ${current === idx ? "w-8 bg-green-500" : "w-2 bg-white/50 hover:bg-white"
              }`}
          />
        ))}
      </div>

      {/* ARROWS (Muncul pas hover) */}
      <button
        onClick={() => setCurrent(current === 0 ? banners.length - 1 : current - 1)}
        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/30 hover:bg-black/60 text-white rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
      >
        ◀
      </button>
      <button
        onClick={() => setCurrent(current === banners.length - 1 ? 0 : current + 1)}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/30 hover:bg-black/60 text-white rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
      >
        ▶
      </button>

    </div>
  );
}