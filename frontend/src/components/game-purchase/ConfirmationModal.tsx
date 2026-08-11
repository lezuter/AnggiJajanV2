'use client'

import React, { useState } from 'react'

export interface ConfirmationModalData {
  userId: string
  zoneId?: string
  gameName: string
  productName: string
  paymentMethodName: string
  paymentMethodImage?: string // image_url
  paymentMethodCode?: string // code (e.g. "bca", "gopay")
  isQris?: boolean // category === "QRIS"
  productAmountLabel: string
  surchargeLabel: string
  hasCustomerSurcharge?: boolean
  totalLabel: string
}

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isProcessing?: boolean
  data: ConfirmationModalData
}

// Subkomponen PaymentLogo presisi sesuai PaymentMethodSelector.tsx
function PaymentLogo ({
  src,
  alt,
  code,
  isQris
}: {
  src?: string
  alt: string
  code?: string
  isQris?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const [isSquareLogo, setIsSquareLogo] = useState(false)

  const hasUsableImage = Boolean(src) && !failed

  if (hasUsableImage && src) {
    const formattedSrc =
      src.startsWith('http://') ||
      src.startsWith('https://') ||
      src.startsWith('/')
        ? src
        : `/${src}`

    return (
      <div
        className={`relative flex shrink-0 items-center justify-end ${
          isSquareLogo
            ? 'h-7 w-7' // Logo 1:1 (Persegi/Ikon): 28px x 28px
            : 'h-[22px] max-w-[80px]' // Logo Lanskap (Panjang)
        }`}
      >
        {/* Glow Layer */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={formattedSrc}
          alt=''
          aria-hidden='true'
          className={`pointer-events-none absolute object-contain opacity-40 blur-[6px] saturate-150 ${
            isSquareLogo ? 'h-7 w-7' : 'h-[22px] max-w-[80px]'
          }`}
        />
        {/* Main Logo Layer */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={formattedSrc}
          alt={alt}
          onLoad={e => {
            const img = e.currentTarget
            if (img.naturalWidth && img.naturalHeight) {
              const ratio = img.naturalWidth / img.naturalHeight
              // Jika rasio <= 1.3, anggap logo 1:1 (persegi)
              setIsSquareLogo(ratio <= 1.3)
            }
          }}
          onError={() => setFailed(true)}
          className={`relative z-10 object-contain ${
            isSquareLogo ? 'h-7 w-7' : 'h-[22px] max-w-[80px] w-auto'
          }`}
        />
      </div>
    )
  }

  // Fallback Badge jika logo gambar kosong / gagal dimuat
  const displayCode = (code || (isQris ? 'QR' : 'PAY')).toUpperCase()

  return (
    <div className='relative flex h-6 px-2 shrink-0 items-center justify-center rounded-full bg-white/[0.08] border border-white/[0.12] shadow-sm'>
      <span className='font-mono text-[9px] font-bold text-white/[0.7] tracking-tighter'>
        {displayCode.slice(0, 6)}
      </span>
    </div>
  )
}

export default function ConfirmationModal ({
  isOpen,
  onClose,
  onConfirm,
  isProcessing = false,
  data
}: ConfirmationModalProps) {
  if (!isOpen) return null

  const targetDisplay = data.zoneId
    ? `${data.userId} (${data.zoneId})`
    : data.userId
  const isSurchargeActive = Boolean(data.hasCustomerSurcharge)

  return (
    <div
      className='fixed inset-0 z-50 bg-black/10 flex items-center justify-center p-4 backdrop-blur-md transition-opacity duration-200'
      onClick={onClose}
    >
      <div
        className='aj-public-glass aj-public-glass--overlay relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/[0.1] p-6 shadow-[0_22px_70px_rgba(0,0,0,0.5)] text-white sm:p-7'
        onClick={e => e.stopPropagation()}
      >

        {/* Header */}
        <div className='flex items-center justify-between pb-4 border-b border-white/[0.08]'>
          <h2 className='text-xl font-medium tracking-tight text-white'>
            Konfirmasi Pesanan
          </h2>
          <button
            type='button'
            onClick={onClose}
            disabled={isProcessing}
            aria-label='Tutup modal'
            className='flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/[0.62] transition-colors hover:border-white/[0.2] hover:bg-white/[0.08] hover:text-white disabled:opacity-50'
          >
            ✕
          </button>
        </div>

        <div className='mt-5 space-y-6'>
          {/* Detail Pesanan */}
          <div>
            <h3 className='mb-3 text-sm font-semibold tracking-wide text-white'>
              Detail Pesanan
            </h3>
            <div className='space-y-2.5'>
              <div className='flex items-start justify-between gap-4'>
                <span className='shrink-0 whitespace-nowrap text-xs text-white/[0.52]'>
                  Game
                </span>
                <span className='text-right text-sm font-medium leading-snug text-white'>
                  {data.gameName || '-'}
                </span>
              </div>
              <div className='flex items-start justify-between gap-4'>
                <span className='shrink-0 whitespace-nowrap text-xs text-white/[0.52]'>
                  Item Produk
                </span>
                <span className='text-right text-sm font-medium leading-snug text-white'>
                  {data.productName || '-'}
                </span>
              </div>
              <div className='flex items-start justify-between gap-4'>
                <span className='shrink-0 whitespace-nowrap text-xs text-white/[0.52]'>
                  Target ID
                </span>
                <span className='text-right text-sm font-medium leading-snug text-white'>
                  {targetDisplay || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Detail Pembayaran */}
          <div>
            <h3 className='mb-3 text-sm font-semibold tracking-wide text-white'>
              Detail Pembayaran
            </h3>
            <div className='space-y-2.5'>
              <div className='flex items-center justify-between gap-4'>
                <span className='shrink-0 whitespace-nowrap text-xs text-white/[0.52]'>
                  Metode Pembayaran
                </span>
                <div className='flex items-center justify-end gap-2.5'>
                  <PaymentLogo
                    src={data.paymentMethodImage}
                    alt={data.paymentMethodName}
                    code={data.paymentMethodCode}
                    isQris={data.isQris}
                  />
                  {/* Tambahkan leading-none agar tidak ada spasi bawaan line-height */}
                  <span className='text-right text-sm font-medium text-white leading-none'>
                    {data.paymentMethodName || '-'}
                  </span>
                </div>
              </div>
              <div className='flex items-center justify-between gap-4'>
                <span className='shrink-0 whitespace-nowrap text-xs text-white/[0.52]'>
                  Harga produk
                </span>
                <span className='text-right text-sm font-medium text-white'>
                  {data.productAmountLabel}
                </span>
              </div>
              <div className='flex items-center justify-between gap-4'>
                <span className='shrink-0 whitespace-nowrap text-xs text-white/[0.52]'>
                  Biaya metode
                </span>
                <span
                  className={`text-right text-sm font-medium ${
                    isSurchargeActive
                      ? 'text-amber-200/[0.82]'
                      : 'text-emerald-300/[0.82]'
                  }`}
                >
                  {isSurchargeActive && data.surchargeLabel !== 'Rp 0'
                    ? data.surchargeLabel
                    : 'Rp 0'}
                </span>
              </div>
            </div>
          </div>

          {/* Total Bayar */}
          <div className='flex items-baseline justify-between border-t border-white/[0.08] pt-4'>
            <span className='text-sm font-semibold uppercase tracking-wide text-white'>
              TOTAL BAYAR
            </span>
            <span className='text-2xl font-bold tracking-tight text-cyan-400'>
              {data.totalLabel}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className='mt-6'>
          <button
            type='button'
            onClick={onConfirm}
            disabled={isProcessing}
            className='flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-white bg-white px-4 text-sm font-semibold text-black transition-all duration-300 hover:border-fuchsia-300 hover:bg-fuchsia-300 hover:shadow-[0_12px_34px_rgba(217,70,239,0.18)] focus-visible:ring-2 focus-visible:ring-fuchsia-400/70 disabled:opacity-50'
          >
            {isProcessing ? (
              <>
                <span className='h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent' />
                <span>Memproses...</span>
              </>
            ) : (
              'Bayar Sekarang'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
