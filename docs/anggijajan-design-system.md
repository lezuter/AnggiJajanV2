# Anggijajan Public Store Design System v3.1

> Dark cyber-glass storefront dengan electric-blue grid, ambient light biru-ungu, dan alur transaksi yang tetap jelas.

Dokumen ini adalah acuan UI/UX public storefront Anggijajan. Arah lama berupa light editorial storefront sudah tidak berlaku. Implementasi aktif di source code tetap menjadi sumber kebenaran utama ketika dokumentasi dan kode berbeda.

Audit terakhir: 30 Juli 2026.

## 1. Sumber kebenaran

Audit file berikut sebelum membuat keputusan visual baru:

- `frontend/src/app/page.tsx`
- `frontend/src/components/Navbar.tsx`
- `frontend/src/components/SiteFooter.tsx`
- `frontend/src/components/PublicCatalogCard.tsx`
- `frontend/src/components/ui/cybernetic-grid-shader.tsx`
- `frontend/src/components/game-purchase/GamePurchaseHero.tsx`
- `frontend/src/components/game-purchase/OrderSummary.tsx`
- `frontend/src/app/game/[slug]/GameDetailClient.tsx`

Dokumen ini menjelaskan pola yang sudah terlihat konsisten. Nilai yang berstatus eksperimen tidak boleh langsung dianggap sebagai token universal.

## 2. Prinsip desain

### 2.1 Dark canvas

Public storefront menggunakan hitam sebagai canvas utama. Area putih hanya digunakan secara terkontrol untuk primary action, teks, dan highlight kontras tinggi.

### 2.2 Atmosfer sebagai kedalaman

Electric-blue grid, cahaya biru, ungu, dan sedikit fuchsia membentuk atmosfer halaman. Efek ini berada di belakang konten dan tidak boleh mengurangi keterbacaan atau usability.

### 2.3 Cyber-glass yang terkendali

Glass dipakai untuk navbar, card katalog, modul transaksi, footer, pill, dan surface penting. Material harus tipis dan gelap, bukan panel buram berat atau neon berlebihan.

### 2.4 Hierarki transaksi tetap utama

Walaupun visual bersifat atmosferik, pengguna harus tetap mudah memahami:

1. katalog yang sedang dibuka;
2. data akun yang harus diisi;
3. produk yang dipilih;
4. metode pembayaran;
5. ringkasan dan status checkout.

### 2.5 Premium, bukan dashboard gaming generik

Gunakan glow, grid, dan fuchsia secara hemat. Hindari terlalu banyak border menyala, badge warna-warni, panel bertumpuk, dan efek yang bersaing dengan konten.

### 2.6 Status layanan harus jujur

Ketika pembelian dinonaktifkan, katalog tetap dapat dilihat. Tombol checkout harus jelas terkunci dan tidak boleh menciptakan kesan transaksi tersedia.

## 3. Warna dan opacity hierarchy

| Peran | Implementasi umum | Penggunaan |
|---|---|---|
| Page canvas | `bg-black` | Background utama |
| Primary text | `text-white` | Judul dan informasi utama |
| Strong secondary | `text-white/[0.76]` | Nilai ringkasan dan copy penting |
| Secondary text | `text-white/[0.62]` sampai `text-white/[0.68]` | Metadata dan supporting copy |
| Muted text | `text-white/[0.38]` sampai `text-white/[0.52]` | Helper, status, label |
| Hairline border | `border-white/[0.08]` | Border default glass surface |
| Strong border | `border-white/[0.1]` sampai `border-white/[0.2]` | Media, hover, dan emphasis |
| Glass black | `bg-black/[0.035]` | Surface utama |
| Glass white | `bg-white/[0.025]` sampai `bg-white/[0.055]` | Inner surface dan hover |
| Interactive accent | `fuchsia-300` / `fuchsia-400` | Focus, selected state, primary hover |
| Active indicator | `blue-400` | Status pembelian aktif |

Aturan:

- Fuchsia adalah accent interaksi, bukan warna background dominan.
- Biru dan ungu pada ambient light tidak menggantikan warna status atau copy.
- Jangan memakai opacity teks rendah untuk informasi yang wajib dibaca.
- Hindari menambah palet baru tanpa kebutuhan semantik.

## 4. Material glass

Kombinasi dasar glass surface:

```txt
border-white/[0.08]
bg-black/[0.035]
backdrop-blur-md
backdrop-saturate-150
shadow-[0_22px_70px_rgba(0,0,0,0.22)]
```

Variasi diperbolehkan berdasarkan skala elemen:

- Pill kecil dapat menggunakan `bg-white/[0.025]`.
- Card hover dapat menaikkan border atau background beberapa tingkat opacity.
- Surface besar boleh memakai blur lebih kuat jika background sangat aktif.
- Glass harus tetap transparan dan menyatu dengan grid, bukan menjadi panel abu-abu solid.

## 5. Grid dan ambient lighting

`CyberneticGridShader` adalah elemen atmosfer utama:

- berada di belakang konten;
- tidak menerima pointer event;
- menggunakan electric blue sebagai warna grid;
- memiliki respons pointer yang halus;
- dibatasi dalam container agar tidak menutupi seluruh document tanpa kebutuhan;
- dipadukan dengan radial vignette dan gradient menuju hitam.

Ambient light menggunakan radial gradient besar dengan blur tinggi:

- ungu umumnya berada di sisi kiri;
- biru dapat muncul di sisi kanan atau bagian lanjutan halaman;
- opacity rendah menjaga teks dan card tetap dominan;
- magenta tidak digunakan sebagai kabut utama di semua area.

## 6. Tipografi

### 6.1 Hierarki

| Peran | Karakter |
|---|---|
| Display / hero | Besar, medium weight, tracking negatif, line-height rapat |
| Section heading | Medium weight, tracking negatif ringan |
| Body | Regular, line-height lega |
| Metadata | Font mono, uppercase, ukuran kecil, tracking lebar |
| Brand | Gunakan font brand yang sudah dimuat oleh aplikasi |

### 6.2 Game purchase hero

Semua judul game memakai fondasi berikut:

```txt
font-medium
tracking-[-0.05em]
leading-[0.95]
break-words
sm:text-balance
md:-ml-[7px]
```

Skala H1 bersifat adaptif berdasarkan panjang `name.trim()`:

| Kondisi | Mobile | Desktop mulai `md` | Batas lebar |
|---|---|---|---|
| Nama pendek, maksimal 20 karakter | `clamp(2rem, 8.5vw, 3rem)` | `clamp(3.5rem, 6.5vw, 5.5rem)` | `820px` |
| Nama panjang, lebih dari 20 karakter | `clamp(2rem, 7.4vw, 2.9rem)` | `clamp(3.15rem, 5.5vw, 4.75rem)` | `620px`, lalu `680px` pada `lg` |

Aturan adaptif menjaga nama pendek tetap monumental, sementara nama panjang seperti Mobile Legends tetap lega dan tidak terlalu banyak tertutup character artwork. Jangan memakai line-clamp untuk H1 karena clipping dapat memotong glyph dan text shadow.

Metadata memakai font mono sekitar `9px` sampai `11px`. Deskripsi memakai ukuran sekitar `14px` sampai `16px` dengan line-height `24px` sampai `28px`.

### 6.3 Keterbacaan di atas artwork

Teks yang berada di atas banner atau ambient background boleh menggunakan text shadow tipis. Shadow harus membantu separasi tanpa menghasilkan outline tebal atau bayangan yang terpotong.

## 7. Layout dan spacing

### 7.1 Container

- Container utama umumnya menggunakan `max-w-6xl`.
- Gutter mobile memakai `px-4`.
- Gutter yang lebih lebar memakai `sm:px-6`.
- Gunakan `min-w-0` pada child grid atau flex yang menampung teks panjang.

### 7.2 Spacing

Gunakan ritme yang sudah dominan:

- jarak kecil: `gap-2` sampai `gap-4`;
- jarak internal card: `p-5` sampai `p-7`;
- jarak antar modul transaksi: `gap-6` atau `space-y-6`;
- section besar dapat menggunakan padding lebih luas sesuai hierarki.

Jangan menambah ruang kosong besar hanya untuk terlihat premium. Periksa hubungan visual antara hero, status layanan, form, dan ringkasan.

Game purchase hero mulai breakpoint `md` menyimpan tinggi minimum responsif:

```txt
md:min-h-[clamp(300px,33vw,380px)]
```

Reserved height ini wajib dijaga selama banner masih menggunakan absolute positioning. Tujuannya agar katalog dengan H1 satu baris tidak lebih pendek dari katalog dengan H1 dua baris dan tidak menabrak modul pembelian berikutnya.

### 7.3 Purchase layout

Desktop memakai dua kolom:

```txt
lg:grid-cols-[minmax(0,1fr)_370px]
```

Kolom utama berisi form dan pilihan produk. Ringkasan berada di sisi kanan dan menjadi sticky pada desktop. Pada ukuran kecil, ringkasan kembali ke flow normal.

## 8. Shape system

| Elemen | Radius umum |
|---|---|
| Catalog poster | `18px` |
| Featured catalog | `22px` |
| Transaction card | `22px` sampai `24px` |
| Large glass surface | `28px` sampai `32px` |
| Input dan inner option | Sekitar `18px` |
| Button dan status pill | `rounded-full` |

Radius menengah adalah bagian dari bahasa visual saat ini. Aturan lama yang mewajibkan card `0px` tidak berlaku.

## 9. Navbar

- Fixed di bagian atas.
- Lebar dibatasi `max-w-6xl`.
- Menggunakan bentuk pill penuh.
- Material: border putih tipis, background hitam transparan, blur, dan saturation.
- Brand berada di kiri.
- Search atau navigasi berada di area tengah sesuai viewport.
- Login berada di kanan.
- Mobile menyederhanakan isi tanpa menghilangkan identitas brand.
- Focus state harus terlihat jelas.

## 10. Catalog cards

Terdapat tiga pola:

### 10.1 Featured

- Aspect ratio `16/10`.
- Radius sekitar `22px`.
- Artwork memenuhi card.
- Gradient bawah membantu judul.
- Rank dapat tampil sebagai pill glass kecil.

### 10.2 Poster

- Aspect ratio `4/5`.
- Radius sekitar `18px`.
- Informasi muncul melalui glass overlay dari bawah saat hover atau keyboard focus.
- Motion memakai transform dan opacity, bukan perubahan layout mendadak.

### 10.3 Provider

- Aspect ratio `5/4`.
- Artwork menggunakan `object-contain`.
- Label dapat muncul di bagian bawah saat interaksi.

Semua card harus:

- dapat diakses dengan keyboard;
- memiliki focus ring;
- menangani gambar gagal dimuat;
- tidak menampilkan harga atau klaim palsu;
- menjaga artwork sebagai elemen dominan.

## 11. Game purchase hero

Hero menyatukan identitas katalog, banner, cover, metadata, status pembelian, dan optional character artwork.

### 11.1 Data identity

Nilai dari database harus diprioritaskan ketika tersedia:

- name;
- short name;
- category;
- publisher;
- region;
- description;
- cover URL;
- banner URL.

Static catalog hanya menjadi fallback ketika metadata database kosong atau API gagal dijangkau.

### 11.2 Banner

- Aspect ratio aktif: `1920/550`.
- Posisi aktif dimulai dari `top-12`.
- Gambar memakai `object-contain object-center`.
- Mask horizontal melembutkan sisi kiri dan kanan.
- Banner berada pada layer dasar hero.
- Banner menggunakan absolute positioning dan tidak menambah tinggi parent secara otomatis.
- Section hero mengompensasi hal tersebut dengan `md:min-h-[clamp(300px,33vw,380px)]`.
- Tinggi hero tidak boleh bergantung hanya pada jumlah baris H1.

### 11.3 Cover dan teks

- Cover memakai aspect ratio `4/5`.
- Lebar cover aktif: `104px` pada mobile, `116px` mulai `sm`, dan `188px` mulai `md`.
- Cover desktop menggunakan `justify-self-end` agar dekat dengan kolom identitas.
- Grid identitas memakai kolom cover `104px`, lalu `116px` pada `sm`, dan kembali ke grid 12 kolom pada `md`.
- Jarak atas grid adalah `mt-9`, `sm:mt-10`, dan `lg:mt-12`.
- Cover dan identitas berada di depan banner.
- Publisher atau category ditampilkan sebagai metadata.
- Nama game menjadi heading utama.
- H1 memakai dua skala berdasarkan threshold panjang nama 20 karakter.
- Nama panjang dibatasi sampai `680px` pada `lg`; nama pendek dapat memakai lebar sampai `820px`.
- Description dan region berada di bawah judul.
- Teks dapat menggunakan shadow tipis untuk menjaga kontras.

### 11.4 Character WebM

Hero mendukung optional transparent WebM untuk menciptakan efek karakter keluar dari banner.

Aturan stabil:

- `autoPlay`;
- `loop`;
- `muted`;
- `playsInline`;
- `preload='auto'`;
- tidak menerima pointer event;
- transparan;
- berada di depan banner dan konten ketika konsep artwork membutuhkannya;
- wrapper karakter tidak boleh memotong bagian artwork yang sengaja keluar dari banner;
- autoplay dan loop harus memiliki fallback yang aman;
- loop visual tidak boleh menghasilkan kedipan yang mengganggu;
- pertimbangkan reduced motion sebelum menjadikannya fitur final.

Referensi eksperimen Mobile Legends saat ini:

```txt
top-12
z-20
w-[50%]
-right-[10%]
h-[130%]
-bottom-[18%]
```

Nilai di atas adalah tuning khusus asset Lylia, bukan token global. Implementasi sementara masih hardcoded untuk slug `mobile-legends` dan belum admin-driven.

Implementasi aktif saat ini menggunakan satu elemen video dengan native `loop`. Tidak ada crossfade JavaScript pada source code terbaru. Karena itu, kelancaran sambungan loop terutama bergantung pada kecocokan frame awal dan akhir asset WebM. Jika kedipan masih terlihat, prioritaskan pembuatan asset yang intrinsically seamless sebelum menambah orchestration video yang lebih kompleks.

### 11.5 Layering reference

| Layer | Peran |
|---:|---|
| Page background | Black canvas, grid, ambient light |
| Hero `z-0` | Banner artwork |
| Hero `z-[2]` dan descendant lokal | Cover, title, description, metadata |
| Hero `z-20` | Character WebM eksperimental |

Hero section dapat memiliki stacking context di atas modul berikutnya agar artwork transparan dapat keluar menuju area Ringkasan. Karena video memakai `pointer-events-none`, kontrol di bawahnya tetap dapat digunakan.

## 12. Transaction modules

Card data akun, produk, pembayaran, dan ringkasan menggunakan pola konsisten:

- radius `22px` sampai `24px`;
- border putih tipis;
- background hitam transparan;
- shadow luas tetapi lembut;
- heading jelas;
- metadata mono;
- divider `border-white/[0.08]`;
- padding responsif.

Jangan mengandalkan glass saja untuk mengelompokkan informasi. Heading, nomor langkah, label input, dan spacing harus tetap menjelaskan struktur.

## 13. Order summary

- Desktop berada pada kolom kanan dengan lebar sekitar `370px`.
- Dapat menjadi sticky dengan offset navbar.
- Nilai menggunakan alignment kanan.
- Label menggunakan warna muted.
- Total memiliki hierarki lebih kuat.
- Status `Aktif` atau `Preview` menggunakan compact pill.
- Disabled checkout harus jelas melalui cursor, opacity, copy, dan state button.

## 14. Buttons, pills, dan states

### 14.1 Primary action

- White fill dan black text.
- Hover dapat bergeser ke fuchsia.
- Min-height sekitar `48px`.
- Radius penuh.
- Focus ring fuchsia yang terlihat.

### 14.2 Ghost action

- Background transparan atau glass tipis.
- Border putih opacity rendah.
- Text putih opacity menengah.
- Hover menaikkan border, background, dan kontras teks.

### 14.3 Disabled

- Gunakan `cursor-not-allowed`.
- Border dan fill tetap terlihat.
- Copy menjelaskan alasan disabled.
- Jangan hanya mengandalkan perubahan warna.

### 14.4 Status dot

- Biru untuk pembelian aktif.
- Putih muted untuk preview atau nonaktif.
- Glow kecil diperbolehkan untuk status aktif.

## 15. Motion

Motion yang digunakan:

- hover transform ringan;
- perubahan opacity;
- glass overlay yang bergerak dari bawah;
- ambient light perlahan;
- footer reveal;
- optional hero character video.

Durasi umum berada di kisaran `300ms` sampai `700ms`. Motion besar dapat menggunakan easing:

```css
cubic-bezier(0.22, 1, 0.36, 1)
```

Aturan:

- jangan menganimasikan layout tanpa alasan;
- gunakan transform dan opacity jika memungkinkan;
- hindari beberapa glow bergerak yang saling bersaing;
- hormati `prefers-reduced-motion`;
- video dekoratif harus muted dan tidak mengganggu interaksi.

## 16. Responsive behavior

Aturan stabil:

- mobile memakai gutter lebih kecil;
- navigation dan label dapat disederhanakan;
- purchase form berubah menjadi satu kolom;
- OrderSummary desktop disembunyikan dan versi inline digunakan;
- typography memakai `clamp`;
- H1 memilih skala pendek atau panjang pada threshold 20 karakter;
- hero mulai `md` memakai minimum height `clamp(300px, 33vw, 380px)`;
- media dan teks memakai `min-w-0` untuk mencegah overflow.

Status keputusan:

- desktop game purchase hero adalah baseline visual saat ini;
- layout hero mobile masih membutuhkan tuning lanjutan;
- character WebM saat ini hanya tampil mulai breakpoint `md`;
- jangan mendokumentasikan hasil mobile sebagai final sebelum pengujian viewport selesai.

## 17. Accessibility

- Semua kontrol harus dapat diakses keyboard.
- Gunakan focus-visible ring dengan kontras cukup.
- Tombol icon-only memerlukan `aria-label`.
- Artwork dekoratif memakai `aria-hidden`.
- Video dekoratif tidak boleh memiliki audio.
- Gambar katalog harus memiliki alt text atau fallback yang masuk akal.
- Informasi status tidak boleh hanya disampaikan melalui warna.
- Pastikan teks muted tetap terbaca di atas grid dan banner.
- Reduced motion harus dipertimbangkan untuk motion dan video dekoratif.

## 18. Implementation guardrails

- Jangan mengubah backend contract untuk kebutuhan visual.
- Jangan mengubah checkout payload tanpa permintaan eksplisit.
- Jangan menghapus `NEXT_PUBLIC_PURCHASES_ENABLED`.
- Pertahankan static export dan `generateStaticParams`.
- Jangan menambah dependency tanpa persetujuan.
- Jangan mengubah admin saat mengerjakan public storefront.
- Jangan membuat harga, testimoni, data akun, kontak, atau klaim layanan palsu.
- Lakukan patch terfokus; jangan rewrite komponen penuh jika perubahan kecil cukup.
- Database dan admin harus menjadi sumber kebenaran metadata katalog ketika integrasi sudah tersedia.

## 19. Checklist sebelum merge

### Visual

- [ ] Canvas tetap hitam dan grid tidak mengganggu konten.
- [ ] Ambient light tidak menurunkan keterbacaan.
- [ ] Glass opacity, border, radius, dan shadow konsisten.
- [ ] Fuchsia digunakan secara terbatas.
- [ ] Tidak ada artwork atau shadow yang terpotong tanpa sengaja.

### Responsive

- [ ] Diuji pada mobile, tablet, laptop, dan desktop lebar.
- [ ] Tidak ada horizontal overflow.
- [ ] Heading panjang tidak merusak grid.
- [ ] Nama pendek dan nama lebih dari 20 karakter memakai skala H1 yang tepat.
- [ ] Katalog dengan H1 satu baris tidak menabrak bagian bawah banner.
- [ ] Ringkasan berpindah posisi dengan benar.
- [ ] Media dekoratif tidak menutupi kontrol penting.

### Interaction

- [ ] Hover dan focus memiliki parity.
- [ ] Disabled state dapat dipahami tanpa warna.
- [ ] Motion tidak berkedip atau melompat.
- [ ] Reduced motion tetap usable.

### Engineering

- [ ] `npx tsc --noEmit` lolos.
- [ ] Targeted ESLint lolos.
- [ ] Tidak ada backend atau checkout contract yang berubah tanpa izin.
- [ ] Tidak ada dependency baru tanpa persetujuan.
- [ ] Eksperimen ditandai jelas dan tidak ditulis sebagai token global.
