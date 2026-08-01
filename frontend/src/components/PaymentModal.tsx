'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

interface PaymentData {
  merchant_ref?: string
  merchant_order_id?: string
  reference?: string
  checkout_url?: string
  payment_url?: string
  app_url?: string
  va_number?: string
  qr_string?: string
  amount?: number
  payment_method?: string
  payment_name?: string
  payment_provider?: string
}

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  data: PaymentData | null
}

interface TransactionStatusResponse {
  status?: string
  sn?: string
}

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
).replace(/\/+$/, '')

export default function PaymentModal ({
  isOpen,
  onClose,
  data
}: PaymentModalProps) {
  const router = useRouter()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [status, setStatus] = useState('UNPAID')
  const [sn, setSn] = useState('')
  const [copied, setCopied] = useState(false)

  const paymentURL = useMemo(
    () => data?.checkout_url || data?.payment_url || '',
    [data]
  )
  const merchantReference = data?.merchant_ref || data?.merchant_order_id || ''
  const paymentName =
    data?.payment_name || data?.payment_method || 'Pembayaran Duitku'

  useEffect(() => {
    if (!isOpen) return

    setStatus('UNPAID')
    setSn('')
    setCopied(false)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus()
    })
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      window.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (
      !isOpen ||
      !data ||
      !merchantReference ||
      status === 'PAID' ||
      status === 'FAILED'
    ) {
      return
    }

    let cancelled = false
    let timeoutId: number | undefined

    const checkStatus = async () => {
      try {
        const referenceQuery = data.reference
          ? `?reference=${encodeURIComponent(data.reference)}`
          : ''
        const response = await fetch(
          `${API_BASE_URL}/transaction/${encodeURIComponent(
            merchantReference
          )}${referenceQuery}`,
          { cache: 'no-store' }
        )

        if (!response.ok) {
          throw new Error(
            `Status transaksi gagal dimuat: HTTP ${response.status}`
          )
        }

        const result = (await response.json()) as TransactionStatusResponse
        if (cancelled) return

        if (result.status === 'PAID') {
          setStatus('PAID')
          setSn(result.sn || '')
          return
        }

        if (result.status === 'FAILED' || result.status === 'EXPIRED') {
          setStatus('FAILED')
          return
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Gagal memeriksa status transaksi:', error)
        }
      }

      if (!cancelled) {
        timeoutId = window.setTimeout(checkStatus, 3000)
      }
    }

    timeoutId = window.setTimeout(checkStatus, 3000)

    return () => {
      cancelled = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [isOpen, data, merchantReference, status])

  if (!isOpen || !data) return null

  const copyVANumber = async () => {
    if (!data.va_number) return

    try {
      await navigator.clipboard.writeText(data.va_number)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div
      className='fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-black/[0.82] p-3 backdrop-blur-md sm:items-center sm:p-6'
      role='presentation'
    >
      <section
        role='dialog'
        aria-modal='true'
        aria-labelledby='payment-modal-title'
        aria-describedby='payment-modal-description'
        className='relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/[0.08] bg-black/[0.76] p-5 text-center text-white shadow-[0_22px_70px_rgba(0,0,0,0.52)] backdrop-blur-xl backdrop-saturate-150 sm:p-7'
      >
        <div
          aria-hidden='true'
          className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_10%_0%,rgba(168,85,247,0.12)_0%,rgba(168,85,247,0.025)_38%,transparent_66%),radial-gradient(ellipse_at_96%_100%,rgba(59,130,246,0.11)_0%,rgba(59,130,246,0.025)_40%,transparent_68%)] mix-blend-screen'
        />

        <button
          ref={closeButtonRef}
          type='button'
          onClick={onClose}
          aria-label='Tutup dialog pembayaran'
          className='absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/[0.52] outline-none transition-[border-color,background-color,color] duration-300 hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-fuchsia-400/70'
        >
          <svg
            aria-hidden='true'
            viewBox='0 0 24 24'
            fill='none'
            className='h-4 w-4'
          >
            <path
              d='m7 7 10 10M17 7 7 17'
              stroke='currentColor'
              strokeLinecap='round'
              strokeWidth='1.8'
            />
          </svg>
        </button>

        <div className='relative z-10'>
          {status === 'UNPAID' && (
            <>
              <p className='font-mono text-[10px] uppercase tracking-[0.12em] text-white/[0.42]'>
                {data.payment_provider || 'Duitku'} Â· {paymentName}
              </p>
              <h2
                id='payment-modal-title'
                className='mt-3 pr-10 text-[28px] font-medium leading-tight tracking-[-0.035em] text-white'
              >
                Lanjutkan pembayaran
              </h2>
              <p
                id='payment-modal-description'
                className='mt-2 text-sm leading-6 text-white/[0.5]'
              >
                Buka halaman pembayaran aman Duitku, lalu selesaikan transaksi
                menggunakan metode yang dipilih.
              </p>

              <div className='mt-6 rounded-[18px] border border-white/[0.08] bg-white/[0.025] p-4'>
                <p className='font-mono text-[9px] uppercase tracking-[0.1em] text-white/[0.4]'>
                  Total tagihan
                </p>
                <p className='mt-2 text-[30px] font-medium tracking-[-0.04em] text-white'>
                  Rp {data.amount ? data.amount.toLocaleString('id-ID') : '0'}
                </p>
                <p className='mt-2 break-all font-mono text-[10px] text-white/[0.34]'>
                  {merchantReference}
                </p>
              </div>

              {data.va_number && (
                <button
                  type='button'
                  onClick={copyVANumber}
                  className='mt-4 w-full rounded-[18px] border border-white/[0.08] bg-white/[0.025] p-4 text-left outline-none transition-colors hover:border-white/[0.16] hover:bg-white/[0.045] focus-visible:ring-2 focus-visible:ring-fuchsia-400/70'
                >
                  <span className='font-mono text-[9px] uppercase tracking-[0.1em] text-white/[0.4]'>
                    Nomor pembayaran
                  </span>
                  <span className='mt-2 flex items-center justify-between gap-3'>
                    <span className='break-all font-mono text-sm text-white/[0.82]'>
                      {data.va_number}
                    </span>
                    <span className='shrink-0 text-xs text-fuchsia-200'>
                      {copied ? 'Tersalin' : 'Salin'}
                    </span>
                  </span>
                </button>
              )}

              {paymentURL ? (
                <a
                  href={paymentURL}
                  target='_blank'
                  rel='noreferrer'
                  className='mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-white bg-white px-6 text-sm font-semibold text-black outline-none transition-[border-color,background-color,box-shadow] duration-300 hover:border-fuchsia-300 hover:bg-fuchsia-300 hover:shadow-[0_12px_34px_rgba(217,70,239,0.18)] focus-visible:ring-2 focus-visible:ring-fuchsia-400/70'
                >
                  Buka halaman pembayaran
                </a>
              ) : (
                <div className='mt-5 rounded-[18px] border border-rose-300/20 bg-rose-300/[0.06] p-4 text-sm leading-6 text-rose-100'>
                  Tautan pembayaran tidak tersedia.
                </div>
              )}

              {data.app_url && data.app_url !== paymentURL && (
                <a
                  href={data.app_url}
                  target='_blank'
                  rel='noreferrer'
                  className='mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.035] px-5 text-sm font-medium text-white outline-none transition-colors hover:border-fuchsia-300/50 hover:bg-fuchsia-400/[0.08] focus-visible:ring-2 focus-visible:ring-fuchsia-400/70'
                >
                  Buka aplikasi pembayaran
                </a>
              )}

              <p className='mt-5 inline-flex items-center gap-2 text-xs text-white/[0.4]'>
                <span
                  aria-hidden='true'
                  className='h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.7)] motion-reduce:animate-none'
                />
                Status pembayaran diperiksa otomatis
              </p>
            </>
          )}

          {status === 'PAID' && (
            <div className='py-7'>
              <div className='mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/[0.09] text-emerald-300'>
                <svg
                  className='h-8 w-8'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                  aria-hidden='true'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M5 13l4 4L19 7'
                  />
                </svg>
              </div>
              <h2
                id='payment-modal-title'
                className='mt-5 text-[28px] font-medium tracking-[-0.035em] text-white'
              >
                Pembayaran berhasil
              </h2>
              <p
                id='payment-modal-description'
                className='mt-2 text-sm leading-6 text-white/[0.5]'
              >
                Top up kamu sedang diproses oleh sistem.
              </p>

              {sn && (
                <div className='mt-6 rounded-[18px] border border-emerald-400/20 bg-emerald-400/[0.06] p-4'>
                  <p className='font-mono text-[9px] uppercase tracking-[0.1em] text-emerald-300/[0.72]'>
                    SN / Bukti
                  </p>
                  <p className='mt-2 break-all font-mono text-sm text-white/[0.78]'>
                    {sn}
                  </p>
                </div>
              )}

              <button
                type='button'
                onClick={() => {
                  onClose()
                  router.push('/cek-pesanan/')
                }}
                className='mt-7 min-h-12 w-full rounded-full border border-white bg-white px-6 text-sm font-semibold text-black outline-none transition-[border-color,background-color,box-shadow] duration-300 hover:border-fuchsia-300 hover:bg-fuchsia-300 hover:shadow-[0_12px_34px_rgba(217,70,239,0.18)] focus-visible:ring-2 focus-visible:ring-fuchsia-400/70'
              >
                Tutup &amp; Cek Pesanan
              </button>
            </div>
          )}

          {status === 'FAILED' && (
            <div className='py-7'>
              <div className='mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-rose-400/30 bg-rose-400/[0.09] text-rose-300'>
                <svg
                  className='h-8 w-8'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                  aria-hidden='true'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M6 18 18 6M6 6l12 12'
                  />
                </svg>
              </div>
              <h2
                id='payment-modal-title'
                className='mt-5 text-[28px] font-medium tracking-[-0.035em] text-white'
              >
                Transaksi gagal
              </h2>
              <p
                id='payment-modal-description'
                className='mt-2 text-sm leading-6 text-white/[0.5]'
              >
                Pembayaran kedaluwarsa, dibatalkan, atau gagal diproses.
              </p>

              <button
                type='button'
                onClick={onClose}
                className='mt-7 min-h-12 w-full rounded-full border border-white/[0.1] bg-white/[0.045] px-6 text-sm font-semibold text-white outline-none transition-[border-color,background-color] duration-300 hover:border-fuchsia-300/70 hover:bg-fuchsia-400/[0.1] focus-visible:ring-2 focus-visible:ring-fuchsia-400/70'
              >
                Tutup
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}