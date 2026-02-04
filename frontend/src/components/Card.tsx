import Link from "next/link";
import Image from "next/image";

interface CardProps {
  title: string;
  image: string;
  slug: string;
  id: number;
  code?: string;
}

export default function Card({ title, image, slug, code }: CardProps) {
  // 🛠️ LOGIC YANG AMAN:
  // 1. Cek apakah ada image dari Backend (Database)?
  // 2. Kalau kosong, pake Placeholder otomatis (Placehold.co)
  // 3. Kita HAPUS dulu logic mapping lokal biar gak error 404 kalau lupa download file
  
  const displayImage = (image && image !== "")
    ? image 
    : `https://placehold.co/400x600?text=${encodeURIComponent(title)}`;

  return (
    <Link
      href={`/game/${slug}`}
      className="group relative block w-full aspect-[3/4] rounded-2xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(255,165,0,0.6)] border border-white/10 bg-[#1e1e1e]"
    >
      {/* Background Image */}
      <div className="absolute inset-0 w-full h-full">
        <Image
          src={displayImage}
          alt={title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-110"
          sizes="(max-width: 768px) 33vw, (max-width: 1200px) 20vw, 15vw"
          // 👇 Penting buat performa & ngilangin warning LCP
          priority={true} 
          loading="eager"
        />
      </div>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90" />

      {/* Content */}
      <div className="absolute bottom-0 p-3 sm:p-4 w-full">
        <h3 className="text-white text-sm sm:text-lg font-bold truncate group-hover:text-yellow-400 transition-colors">
          {title}
        </h3>

        <div className="flex items-center justify-between mt-1">
          <p className="text-[10px] sm:text-xs text-gray-400">
            Top Up Instan
          </p>

          {/* Badge Code dari SmartCode Backend */}
          {code && (
            <span className="text-[10px] font-mono bg-blue-600/30 px-1.5 py-0.5 rounded text-blue-200 border border-blue-500/30">
              {code}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}