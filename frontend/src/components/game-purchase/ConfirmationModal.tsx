'use client'

import React, { useState } from 'react'

export interface ConfirmationModalData {
  userId: string
  zoneId?: string
  gameName: string
  productName: string
  quantity?: number
  contactInfo?: string
  paymentMethodName: string
  paymentMethodImage?: string
  paymentMethodCode?: string
  isQris?: boolean
  productAmountLabel: string
  surchargeLabel: string
  hasCustomerSurcharge?: boolean
  appliedPromoCode?: string
  totalLabel: string
}

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isProcessing?: boolean
  data: ConfirmationModalData
}

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
        className={`relative flex shrink-0 items-center justify-center self-center ${
          isSquareLogo ? 'h-7 w-7' : 'h-[25px] max-w-[92px]'
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={formattedSrc}
          alt=''
          aria-hidden='true'
          className={`pointer-events-none absolute object-contain opacity-40 blur-[6px] saturate-150 ${
            isSquareLogo ? 'h-7 w-7' : 'h-[25px] max-w-[92px]'
          }`}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={formattedSrc}
          alt={alt}
          onLoad={e => {
            const img = e.currentTarget
            if (img.naturalWidth && img.naturalHeight) {
              const ratio = img.naturalWidth / img.naturalHeight
              setIsSquareLogo(ratio <= 1.3)
            }
          }}
          onError={() => setFailed(true)}
          className={`relative z-10 object-contain ${
            isSquareLogo ? 'h-7 w-7' : 'h-[25px] max-w-[92px] w-auto'
          }`}
        />
      </div>
    )
  }

  const displayCode = (code || (isQris ? 'QR' : 'PAY')).toUpperCase()

  return (
    <div className='relative flex h-5 px-2 shrink-0 items-center justify-center rounded-full bg-white/[0.08] border border-white/[0.12] shadow-sm'>
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
  const hasAdditionalInfo = Boolean(data.contactInfo || data.appliedPromoCode)

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-opacity duration-200'
      onClick={onClose}
    >
      <div
        className='aj-public-glass aj-public-glass--overlay relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/[0.1] p-6 shadow-[0_22px_70px_rgba(0,0,0,0.6)] text-white sm:p-7'
        onClick={e => e.stopPropagation()}
      >
        <div
          aria-hidden='true'
          className='pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.22] to-transparent'
        />

        {/* Header */}
        <div className='relative z-10 flex items-center justify-between pb-4 border-b border-white/[0.08]'>
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

        {/* Content Body */}
        <div className='relative z-10 mt-5 space-y-5'>
          {/* GRUP 1: DETAIL PESANAN */}
          <div>
            <p className='mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-white/[0.88]'>
              DETAIL PESANAN
            </p>
            <div className='space-y-2.5 text-sm'>
              <div className='flex items-start justify-between gap-4'>
                <span className='text-sm text-white/[0.44]'>Game</span>
                <span className='text-right font-medium text-white/[0.88]'>
                  {data.gameName || '-'}
                </span>
              </div>
              <div className='flex items-start justify-between gap-4'>
                <span className='text-sm text-white/[0.44]'>Produk</span>
                <span className='text-right font-medium text-white/[0.88]'>
                  {data.productName || '-'}
                </span>
              </div>
              <div className='flex items-start justify-between gap-4'>
                <span className='text-sm text-white/[0.44]'>Detail Akun</span>
                <span className='text-right font-medium text-white/[0.88]'>
                  {targetDisplay || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* GRUP 2: DETAIL PEMBAYARAN */}
          <div className='border-t border-white/[0.08] pt-4'>
            <p className='mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-white/[0.88]'>
              DETAIL PEMBAYARAN
            </p>
            <div className='space-y-2.5 text-sm'>
              <div className='flex items-center justify-between gap-4'>
                <span className='text-sm text-white/[0.44]'>Harga produk</span>
                <span className='text-right font-medium text-white/[0.88]'>
                  {data.productAmountLabel}
                </span>
              </div>
              {data.quantity && data.quantity > 1 && (
                <div className='flex items-center justify-between gap-4'>
                  <span className='text-sm text-white/[0.44]'>Jumlah</span>
                  <span className='text-right font-mono font-semibold text-white'>
                    {data.quantity}x
                  </span>
                </div>
              )}
              <div className='flex items-center justify-between gap-4'>
                <span className='text-sm text-white/[0.44]'>Pembayaran</span>
                <div className='flex items-center justify-end gap-2.5'>
                  <PaymentLogo
                    src={data.paymentMethodImage}
                    alt={data.paymentMethodName}
                    code={data.paymentMethodCode}
                    isQris={data.isQris}
                  />
                  <span className='text-right font-medium text-white/[0.88] leading-none'>
                    {data.paymentMethodName || '-'}
                  </span>
                </div>
              </div>
              <div className='flex items-center justify-between gap-4'>
                <span className='text-sm text-white/[0.44]'>Biaya metode</span>
                <span
                  className={`text-right font-medium ${
                    isSurchargeActive && data.surchargeLabel !== 'Rp 0'
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

          {/* GRUP 3: INFORMASI TAMBAHAN (KONDISIONAL) */}
          {hasAdditionalInfo && (
            <div className='border-t border-white/[0.08] pt-5 mt-1'>
              <p className='mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-white/[0.88]'>
                INFORMASI TAMBAHAN
              </p>
              <div className='space-y-3 text-sm'>
                {data.contactInfo && (
                  <div className='flex items-center justify-between gap-4'>
                    <span className='text-sm text-white/[0.44]'>Kontak</span>
                    <span className='break-all text-right text-sm font-medium text-white/[0.88]'>
                      {data.contactInfo}
                    </span>
                  </div>
                )}
                {data.appliedPromoCode && (
                  <div className='flex items-center justify-between gap-4'>
                    <span className='text-sm text-white/[0.44]'>
                      Kode promo
                    </span>
                    <span className='text-right font-mono text-sm font-semibold text-fuchsia-300'>
                      {data.appliedPromoCode}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TOTAL BAYAR (CYAN) */}
          <div className='flex items-baseline justify-between border-t border-white/[0.08] pt-4'>
            <span className='font-medium text-sm uppercase tracking-[0.1em] text-white'>
              TOTAL BAYAR
            </span>
            <span className='text-2xl font-bold tracking-tight text-cyan-400'>
              {data.totalLabel}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className='relative z-10 mt-6'>
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
