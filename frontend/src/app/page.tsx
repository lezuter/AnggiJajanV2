"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "../components/Navbar";
import GreenTable from "../components/GreenTable";

// Import Swiper
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, EffectFade } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';

interface Banner {
  id: number;
  image_url: string;
  target_url: string;
}

interface Catalog {
  cardcode: string;
  name: string;
  slug: string;
  image_url: string;
  category: string;
}

export default function HomePage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch Banner & Katalog Paralel biar cepet
        const [resBanner, resCatalog] = await Promise.all([
          fetch("http://localhost:3001/api/banners"),
          fetch("http://localhost:3001/api/catalogs")
        ]);

        const dataBanner = await resBanner.json();
        const dataCatalog = await resCatalog.json();

        setBanners(Array.isArray(dataBanner) ? dataBanner : []);
        setCatalogs(Array.isArray(dataCatalog) ? dataCatalog : []);
      } catch (error) {
        console.error("Gagal load data", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Filter Search
  const filteredCatalogs = catalogs.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    // 👇 BACKGROUND AJAIB DISINI (Ganti style div paling luar)
    <div className="min-h-screen bg-[#050505] text-white relative overflow-x-hidden selection:bg-green-500/30">
      
      {/* --- 1. BACKGROUND EFFECT (AURORA SPIKE) --- */}
      <div className="fixed top-0 left-0 w-full h-[800px] z-0 pointer-events-none">
        {/* Glow Hijau Utama di Tengah Atas */}
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[80%] h-[600px] bg-green-900/20 blur-[120px] rounded-full mix-blend-screen"></div>
        
        {/* Efek Bintik-Bintik (Noise/Stars) */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
        
        {/* Garis Grid Halus (Opsional, biar makin techy) */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
      </div>

      {/* Konten Website (Harus z-10 biar di atas background) */}
      <div className="relative z-10">
        <Navbar />

        {/* --- HERO SECTION --- */}
        <div className="pt-32 pb-10 px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">
              ICN <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">Protocol</span> Store
            </h1>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg mb-8">
              Decentralized top-up ecosystem. Fast, secure, and automated.
            </p>
            
            {/* Contoh Banner Swiper lu bisa taruh sini */}
        </div>

        {/* --- TABLE SECTION (GAYA BARU) --- */}
        <div className="container mx-auto px-4 pb-20">
            <div className="flex items-center justify-between mb-6 px-2">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <span className="w-1 h-6 bg-green-500 rounded-full shadow-[0_0_10px_#22c55e]"></span>
                    Network Overview
                </h2>
                
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold hover:bg-white/10 transition">
                        Filter Region ▾
                    </button>
                </div>
            </div>

            {/* 👇 TABLE KITA */}
            <GreenTable /> 
        </div>

        <footer className="border-t border-white/5 bg-[#08080a] py-8 text-center mt-10 relative z-20">
            <p className="text-gray-600 text-sm">© 2026 AnggiJajan x ICN Protocol Style.</p>
        </footer>
      </div>
    </div>
  );
}