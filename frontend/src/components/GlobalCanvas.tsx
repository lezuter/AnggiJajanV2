"use client";

import { Canvas } from "@react-three/fiber";
import { View } from "@react-three/drei";

export default function GlobalCanvas() {
  return (
    // Mesin WebGL ditaruh fixed menuhin layar, pointer-events-none biar klik tembus ke web lu
    <Canvas
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 9999, // Harus di atas supaya model 3D-nya gak ketutupan div lain
      }}
      camera={{ position: [0, 0, 5], fov: 45 }}
    >
      {/* 🔥 INI KUNCINYA: View.Port bakal nyedot semua <View> dari sidebar lu! 🔥 */}
      <View.Port />
    </Canvas>
  );
}