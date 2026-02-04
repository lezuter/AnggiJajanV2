/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co', // Yang tadi kita pake
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com', // Sisaan lama
      },
      {
        protocol: 'https',
        hostname: 'i.imgur.com', // 👈 TAMBAHIN INI BIAR GAMBAR USER MUNCUL
      },
    ],
  },
};

module.exports = nextConfig;