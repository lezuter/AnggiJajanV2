import React from "react";

interface Product {
  ID: number;
  name: string;
  code: string;
  price: number;
  stock: number;
}

interface ProductCardProps {
  product: Product;
  onClick: (product: Product) => void;
}

export default function ProductCard({ product, onClick }: ProductCardProps) {
  // Cek Status Stok
  const isHabis = product.stock !== -1 && product.stock <= 0;
  const isUnlimited = product.stock === -1;

  return (
    <div
      onClick={() => !isHabis && onClick(product)}
      className={`relative group bg-gray-900 border border-gray-800 rounded-2xl p-4 transition-all duration-300 ${
        isHabis
          ? "opacity-50 cursor-not-allowed grayscale"
          : "hover:border-green-500 hover:shadow-lg hover:shadow-green-900/20 hover:-translate-y-1 cursor-pointer"
      }`}
    >
      {/* Badge Stok */}
      <div className="absolute top-3 right-3 z-10">
        {isHabis ? (
          <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">
            Habis
          </span>
        ) : isUnlimited ? (
          <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">
            Auto
          </span>
        ) : (
          <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">
            Stok: {product.stock}
          </span>
        )}
      </div>

      {/* Icon Game (Placeholder) */}
      <div className="w-12 h-12 bg-gray-800 rounded-xl mb-4 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-300 shadow-inner">
        🎮
      </div>

      {/* Detail Produk */}
      <div className="space-y-1">
        <h3 className="font-bold text-white text-sm md:text-base leading-tight line-clamp-2 group-hover:text-green-400 transition-colors">
          {product.name}
        </h3>
        <p className="text-[10px] text-gray-500 font-mono tracking-wide uppercase">
          {product.code}
        </p>
      </div>

      {/* Harga & Tombol */}
      <div className="mt-4 flex items-end justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] text-gray-400">Harga</span>
          <span className="text-green-400 font-bold text-lg">
            Rp {product.price.toLocaleString("id-ID")}
          </span>
        </div>
        
        <button className={`p-2 rounded-lg transition-colors ${isHabis ? 'bg-gray-800 text-gray-600' : 'bg-green-600 hover:bg-green-500 text-white'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
        </button>
      </div>
    </div>
  );
}