"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Banner {
  ID: number;
  image_url: string;
  description: string;
}

export default function BannerCarousel() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const res = await fetch("http://localhost:3001/api/banners");
        const data = await res.json();
        setBanners(
          Array.isArray(data)
            ? data.filter((b: any) => b.is_active !== false)
            : [],
        );
      } catch (err) {
        console.error("Gagal load banner", err);
      }
    };
    fetchBanners();
  }, []);

  useEffect(() => {
    if (banners.length === 0) return;
    const timer = setInterval(
      () => setCurrent((prev) => (prev === banners.length - 1 ? 0 : prev + 1)),
      5000,
    );
    return () => clearInterval(timer);
  }, [banners.length]);

  if (banners.length === 0)
    return (
      <div className="w-full h-64 bg-white/[0.03] rounded-[16px] animate-pulse backdrop-blur-md border border-white/10" />
    );

  return (
    /* CONTAINER 3D PERSPECTIVE (Sesuai SKILL.md) */
    <div className="w-full h-[350px] [perspective:1200px] mt-8">
      <motion.div
        className="relative w-full h-full rounded-[16px] overflow-hidden border border-white/10 shadow-2xl bg-white/[0.05] backdrop-blur-[16px] backdrop-saturate-[1.4]"
        whileHover={{ rotateX: 2, rotateY: -2, scale: 1.02 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={banners[current].ID}
            src={banners[current].image_url}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full h-full object-cover"
          />
        </AnimatePresence>

        {/* Glass Overlay Text (Depth: translateZ) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent [transform:translateZ(30px)]">
          <div className="absolute bottom-0 p-8">
            <h2 className="text-white text-2xl font-bold">
              {banners[current].description}
            </h2>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
