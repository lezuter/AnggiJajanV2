'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { payWithMidtransSnap } from '@/lib/midtransSnap'

interface PaymentData {
  snap_token?: string
  redirect_url?: string
  invoice_id?: string
  merchant_ref?: string
  merchant_order_id?: string
  reference?: string
  amount?: number
  payment_method?: string
  payment_name?: string
  payment_provider?: string
  expiry_time?: string
}

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  data: PaymentData | null
}

interface TransactionStatusResponse {
  status: string
  payment_status?: string
  sn?: string
}

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
).replace(/\/+$/, '')

type PaymentStatus = 'UNPAID' | 'PAID' | 'FAILED'

function LottiePlayer ({ animationPath }: { animationPath: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let anim: any

    import('lottie-web')
      .then(lottie => {
        if (!containerRef.current) return

        containerRef.current.innerHTML = ''

        anim = lottie.default.loadAnimation({
          container: containerRef.current,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: animationPath
        })
      })
      .catch(error => {
        console.warn('Gagal memuat animasi Lottie:', error)
      })

    return () => {
      if (anim) {
        anim.destroy()
      }
    }
  }, [animationPath])

  return (
    <div
      ref={containerRef}
      className='mx-auto flex h-28 w-28 items-center justify-center'
      aria-hidden='true'
    />
  )
}

function formatTime (seconds: number) {
  const safeSeconds = Math.max(0, seconds)

  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const secs = safeSeconds % 60

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return `${minutes.toString().padStart(2, '0')}:${secs
    .toString()
    .padStart(2, '0')}`
}

function formatIDR (amount?: number) {
  if (!amount || amount <= 0) {
    return 'Rp 0'
  }

  return `Rp ${amount.toLocaleString('id-ID')}`
}

function getExpiryTimestamp (expiryTime?: string) {
  if (!expiryTime) {
    return null
  }

  const timestamp = Date.parse(expiryTime)

  if (Number.isNaN(timestamp)) {
    return null
  }

  return timestamp
}

export default function PaymentModal ({
  isOpen,
  onClose,
  data
}: PaymentModalProps) {
  const router = useRouter()

  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const openedTokenRef = useRef('')
  const redirectedRef = useRef(false)

  const [status, setStatus] = useState<PaymentStatus>('UNPAID')
  const [sn, setSn] = useState('')
  const [snapLoading, setSnapLoading] = useState(false)
  const [snapError, setSnapError] = useState('')
  const [timeLeft, setTimeLeft] = useState(0)

  const merchantReference =
    data?.invoice_id ||
    data?.merchant_ref ||
    data?.merchant_order_id ||
    ''

  const paymentName =
    data?.payment_name ||
    data?.payment_method ||
    'Midtrans'

  const expiryTimestamp = getExpiryTimestamp(data?.expiry_time)

  /*
   * Redirect ke halaman cek pesanan hanya boleh dilakukan sekali.
   */
  const goToOrderCheck = useCallback(() => {
    if (redirectedRef.current) {
      return
    }

    redirectedRef.current = true

    onClose()
    router.push('/cek-pesanan/')
  }, [onClose, router])

  /*
   * Buka Midtrans Snap secara otomatis.
   *
   * Tidak ada lagi tombol "Buka pembayaran Midtrans".
   */
  const openSnap = useCallback(async () => {
    const token = data?.snap_token?.trim()

    if (!token) {
      setSnapError('Token pembayaran Midtrans tidak tersedia.')
      return
    }

    /*
     * Jangan membuka Snap dua kali untuk token transaksi yang sama.
     */
    if (openedTokenRef.current === token) {
      return
    }

    openedTokenRef.current = token

    setSnapLoading(true)
    setSnapError('')

    try {
      await payWithMidtransSnap(token, {
        onSuccess: () => {
          setSnapLoading(false)
          setStatus('PAID')
        },

        onPending: () => {
          setSnapLoading(false)
          goToOrderCheck()
        },

        onError: () => {
          setSnapLoading(false)

          setSnapError(
            'Pembayaran belum berhasil diproses. Silakan coba kembali melalui halaman pesanan.'
          )
        },

        onClose: () => {
          setSnapLoading(false)
          goToOrderCheck()
        }
      })
    } catch (error) {
      setSnapLoading(false)

      setSnapError(
        error instanceof Error
          ? error.message
          : 'Pembayaran Midtrans gagal dibuka.'
      )
    }
  }, [data?.snap_token, goToOrderCheck])

  /*
   * Reset state setiap transaksi/modal baru.
   */
  useEffect(() => {
    if (!isOpen) {
      return
    }

    setStatus('UNPAID')
    setSn('')
    setSnapError('')
    setSnapLoading(false)

    redirectedRef.current = false
    openedTokenRef.current = ''
  }, [isOpen, data?.snap_token])

  /*
   * Auto-open Midtrans Snap ketika transaksi baru tersedia.
   */
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const token = data?.snap_token?.trim()

    if (!token) {
      return
    }

    if (openedTokenRef.current === token) {
      return
    }

    void openSnap()
  }, [isOpen, data?.snap_token, openSnap])

  /*
   * Countdown berdasarkan expiry_time dari backend.
   *
   * TIDAK ADA hardcode 900 detik di sini.
   *
   * Backend mengirim:
   *
   * expiry_time: "2026-08-09T..."
   *
   * Frontend menghitung:
   *
   * expiry_timestamp - Date.now()
   */
  useEffect(() => {
    if (!isOpen || status !== 'UNPAID') {
      return
    }

    if (!expiryTimestamp) {
      setTimeLeft(0)
      return
    }

    const updateCountdown = () => {
      const remainingMilliseconds =
        expiryTimestamp - Date.now()

      const remainingSeconds = Math.max(
        0,
        Math.ceil(remainingMilliseconds / 1000)
      )

      setTimeLeft(remainingSeconds)

      if (remainingSeconds <= 0) {
        setStatus('FAILED')
      }
    }

    updateCountdown()

    const interval = window.setInterval(
      updateCountdown,
      1000
    )

    return () => {
      window.clearInterval(interval)
    }
  }, [isOpen, status, expiryTimestamp])

  /*
   * Accessibility / focus management.
   */
  useEffect(() => {
    if (!isOpen) {
      return
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener(
      'keydown',
      handleKeyDown
    )

    return () => {
      window.cancelAnimationFrame(focusFrame)

      window.removeEventListener(
        'keydown',
        handleKeyDown
      )

      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [isOpen, onClose])

  /*
   * Poll status transaksi ke backend.
   *
   * Backend tetap menjadi source of truth untuk status pembayaran.
   */
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
          ? `?reference=${encodeURIComponent(
              data.reference
            )}`
          : ''

        const response = await fetch(
          `${API_BASE_URL}/transaction/${encodeURIComponent(
            merchantReference
          )}${referenceQuery}`,
          {
            cache: 'no-store'
          }
        )

        if (!response.ok) {
          throw new Error(
            `Status transaksi gagal dimuat: HTTP ${response.status}`
          )
        }

        const result =
          (await response.json()) as TransactionStatusResponse

        if (cancelled) {
          return
        }

        if (
          result.payment_status === 'PAID' ||
          result.status === 'PAID'
        ) {
          setStatus('PAID')
          setSn(result.sn || '')
          return
        }

        if (
          result.payment_status === 'FAILED' ||
          result.payment_status === 'EXPIRED' ||
          result.status === 'FAILED' ||
          result.status === 'EXPIRED'
        ) {
          setStatus('FAILED')
          return
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            'Gagal memeriksa status transaksi:',
            error
          )
        }
      }

      if (!cancelled) {
        timeoutId = window.setTimeout(
          checkStatus,
          3000
        )
      }
    }

    timeoutId = window.setTimeout(
      checkStatus,
      3000
    )

    return () => {
      cancelled = true

      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [
    isOpen,
    data,
    merchantReference,
    status
  ])

  if (!isOpen || !data) {
    return null
  }

  const isExpired =
    status === 'FAILED' ||
    (expiryTimestamp !== null &&
      expiryTimestamp <= Date.now())

  return (
    <div
      className='fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-black/70 p-3 sm:items-center sm:p-6'
      role='presentation'
    >
      <section
        role='dialog'
        aria-modal='true'
        aria-labelledby='payment-modal-title'
        aria-describedby='payment-modal-description'
        className='relative w-full max-w-md overflow-hidden rounded-[24px] border border-black/10 bg-white p-5 text-black shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-7'
      >
        {/* Close */}
        <button
          ref={closeButtonRef}
          type='button'
          onClick={onClose}
          aria-label='Tutup dialog pembayaran'
          className='absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-black/[0.03] text-black/50 transition-colors outline-none hover:bg-black/[0.07] hover:text-black focus-visible:ring-2 focus-visible:ring-black/20'
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

        <div>
          {/* =========================
              UNPAID
             ========================= */}
          {status === 'UNPAID' && (
            <>
              <div className='pr-10'>
                <p className='text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40'>
                  {paymentName}
                </p>

                <h2
                  id='payment-modal-title'
                  className='mt-2 text-[28px] font-semibold leading-tight tracking-[-0.035em] text-black'
                >
                  Selesaikan pembayaran
                </h2>

                <p
                  id='payment-modal-description'
                  className='mt-2 text-sm leading-6 text-black/50'
                >
                  Jendela pembayaran Midtrans sedang
                  dibuka. Selesaikan pembayaran sebelum
                  batas waktu berakhir.
                </p>
              </div>

              {/* Countdown */}
              <div
                className={[
                  'mt-5 flex items-center justify-between rounded-2xl border px-4 py-3',
                  timeLeft <= 60
                    ? 'border-red-200 bg-red-50'
                    : 'border-black/10 bg-black/[0.025]'
                ].join(' ')}
              >
                <div className='flex items-center gap-2'>
                  <span
                    className={[
                      'h-2 w-2 rounded-full',
                      timeLeft <= 60
                        ? 'bg-red-500 animate-pulse'
                        : 'bg-black'
                    ].join(' ')}
                    aria-hidden='true'
                  />

                  <span className='text-xs font-medium text-black/55'>
                    Batas pembayaran
                  </span>
                </div>

                <span
                  className={[
                    'font-mono text-base font-bold tabular-nums',
                    timeLeft <= 60
                      ? 'text-red-600'
                      : 'text-black'
                  ].join(' ')}
                >
                  {formatTime(timeLeft)}
                </span>
              </div>

              {/* Invoice Summary */}
              <div className='mt-4 rounded-2xl border border-black/10 bg-black/[0.02] p-4'>
                <div className='flex items-center justify-between gap-4'>
                  <span className='text-xs text-black/45'>
                    Total pembayaran
                  </span>

                  <span className='text-lg font-bold tracking-tight text-black'>
                    {formatIDR(data.amount)}
                  </span>
                </div>

                <div className='mt-3 border-t border-black/[0.07] pt-3'>
                  <p className='text-[10px] uppercase tracking-[0.1em] text-black/35'>
                    Invoice
                  </p>

                  <p className='mt-1 break-all font-mono text-[11px] text-black/55'>
                    {merchantReference || '-'}
                  </p>
                </div>
              </div>

              {/* Snap loading state */}
              {snapLoading && (
                <div className='mt-5 flex items-center justify-center gap-3 rounded-2xl border border-black/10 bg-black/[0.025] px-4 py-4'>
                  <span className='h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black' />

                  <span className='text-xs font-medium text-black/55'>
                    Membuka pembayaran Midtrans...
                  </span>
                </div>
              )}

              {/* Snap error */}
              {snapError && (
                <div
                  role='alert'
                  className='mt-4 rounded-2xl border border-red-200 bg-red-50 p-4'
                >
                  <p className='text-xs leading-5 text-red-700'>
                    {snapError}
                  </p>

                  <button
                    type='button'
                    onClick={() => {
                      openedTokenRef.current = ''
                      void openSnap()
                    }}
                    className='mt-3 rounded-full bg-black px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-black/80'
                  >
                    Coba buka kembali
                  </button>
                </div>
              )}

              {/* Expiry info */}
              <div className='mt-5 text-center'>
                <p className='text-[11px] leading-5 text-black/35'>
                  Status pembayaran diperiksa otomatis.
                </p>

                {data.expiry_time && (
                  <p className='mt-1 text-[10px] text-black/25'>
                    Batas waktu mengikuti expiry dari
                    transaksi Midtrans.
                  </p>
                )}
              </div>
            </>
          )}

          {/* =========================
              PAID
             ========================= */}
          {status === 'PAID' && (
            <div className='py-4 text-center'>
              <LottiePlayer
                animationPath='/animations/success.json'
              />

              <h2
                id='payment-modal-title'
                className='mt-3 text-[26px] font-semibold tracking-[-0.035em] text-black'
              >
                Pembayaran berhasil
              </h2>

              <p
                id='payment-modal-description'
                className='mt-2 text-sm leading-6 text-black/50'
              >
                Pembayaran berhasil diterima dan top up
                kamu sedang diproses oleh sistem.
              </p>

              {sn && (
                <div className='mt-5 rounded-2xl border border-black/10 bg-black/[0.025] p-4 text-left'>
                  <p className='text-[10px] font-semibold uppercase tracking-[0.1em] text-black/35'>
                    Serial Number
                  </p>

                  <p className='mt-1 break-all font-mono text-sm text-black/75'>
                    {sn}
                  </p>
                </div>
              )}

              <button
                type='button'
                onClick={goToOrderCheck}
                className='mt-6 min-h-12 w-full rounded-full bg-black px-6 text-sm font-semibold text-white transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30'
              >
                Cek pesanan
              </button>
            </div>
          )}

          {/* =========================
              FAILED / EXPIRED
             ========================= */}
          {status === 'FAILED' && (
            <div className='py-4 text-center'>
              <LottiePlayer
                animationPath='/animations/error.json'
              />

              <h2
                id='payment-modal-title'
                className='mt-3 text-[26px] font-semibold tracking-[-0.035em] text-black'
              >
                Pembayaran berakhir
              </h2>

              <p
                id='payment-modal-description'
                className='mt-2 text-sm leading-6 text-black/50'
              >
                {isExpired
                  ? 'Batas waktu pembayaran telah berakhir.'
                  : 'Pembayaran dibatalkan atau gagal diproses.'}
              </p>

              <button
                type='button'
                onClick={onClose}
                className='mt-6 min-h-12 w-full rounded-full border border-black/10 bg-black/[0.04] px-6 text-sm font-semibold text-black transition-colors hover:bg-black/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20'
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