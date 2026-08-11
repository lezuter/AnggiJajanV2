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

// Subkomponen Pemutar Animasi Lottie (Support Next.js SSR)
function LottiePlayer ({ animationPath }: { animationPath: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let anim: any

    import('lottie-web')
      .then(lottie => {
        if (containerRef.current) {
          containerRef.current.innerHTML = ''
          anim = lottie.default.loadAnimation({
            container: containerRef.current,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            path: animationPath // Mengambil file JSON dari /public/animations/
          })
        }
      })
      .catch(err => {
        console.warn('Gagal memuat animasi lottie:', err)
      })

    return () => {
      if (anim) anim.destroy()
    }
  }, [animationPath])

  return (
    <div
      ref={containerRef}
      className='mx-auto h-28 w-28 flex items-center justify-center'
    />
  )
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
  const [status, setStatus] = useState<'UNPAID' | 'PAID' | 'FAILED'>('UNPAID')
  const [sn, setSn] = useState('')
  const [snapLoading, setSnapLoading] = useState(false)
  const [snapError, setSnapError] = useState('')

  const merchantReference =
    data?.invoice_id || data?.merchant_ref || data?.merchant_order_id || ''
  const paymentName = data?.payment_name || data?.payment_method || 'Midtrans'

  const goToOrderCheck = useCallback(() => {
    if (redirectedRef.current) return
    redirectedRef.current = true
    onClose()
    router.push('/cek-pesanan/')
  }, [onClose, router])

  const openSnap = useCallback(async () => {
    const token = data?.snap_token?.trim()
    if (!token) {
      setSnapError('Token pembayaran Midtrans tidak tersedia.')
      return
    }

    setSnapLoading(true)
    setSnapError('')

    try {
      await payWithMidtransSnap(token, {
        onSuccess: () => {
          setStatus('PAID')
          setSnapLoading(false)
        },
        onPending: goToOrderCheck,
        onError: () => {
          setSnapLoading(false)
          setSnapError(
            'Pembayaran belum berhasil diproses. Kamu dapat membuka Snap kembali.'
          )
        },
        onClose: goToOrderCheck
      })
    } catch (error) {
      setSnapError(
        error instanceof Error
          ? error.message
          : 'Pembayaran Midtrans gagal dibuka.'
      )
    } finally {
      setSnapLoading(false)
    }
  }, [data?.snap_token, goToOrderCheck])

  useEffect(() => {
    if (!isOpen) return

    setStatus('UNPAID')
    setSn('')
    setSnapError('')
    redirectedRef.current = false
    openedTokenRef.current = ''
  }, [isOpen, data?.snap_token])

  useEffect(() => {
    const token = data?.snap_token?.trim() || ''
    if (!isOpen || !token || openedTokenRef.current === token) return

    openedTokenRef.current = token
    void openSnap()
  }, [isOpen, data?.snap_token, openSnap])

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

        if (result.payment_status === 'PAID' || result.status === 'PAID') {
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
          console.error('Gagal memeriksa status transaksi:', error)
        }
      }

      if (!cancelled) timeoutId = window.setTimeout(checkStatus, 3000)
    }

    timeoutId = window.setTimeout(checkStatus, 3000)
    return () => {
      cancelled = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [isOpen, data, merchantReference, status])

  if (!isOpen || !data) return null

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
          className='absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/[0.52] outline-none transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-fuchsia-400/70'
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
          {/* STATE 1: UNPAID (Selesaikan Pembayaran) */}
          {status === 'UNPAID' && (
            <>
              \n{' '}
              <p className='font-mono text-[10px] uppercase tracking-[0.12em] text-white/[0.42]'>
                MIDTRANS · {paymentName}
              </p>
              <h2
                id='payment-modal-title'
                className='mt-3 pr-10 text-[28px] font-medium leading-tight tracking-[-0.035em] text-white'
              >
                Selesaikan pembayaran
              </h2>
              <p
                id='payment-modal-description'
                className='mt-2 text-sm leading-6 text-white/[0.5]'
              >
                Snap dibuka langsung ke metode yang kamu pilih. Daftar metode
                tidak akan ditampilkan ulang.
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
              {snapError && (
                <p
                  role='alert'
                  className='mt-4 rounded-[18px] border border-rose-300/20 bg-rose-300/[0.06] p-4 text-sm leading-6 text-rose-100'
                >
                  {snapError}
                </p>
              )}
              <button
                type='button'
                onClick={() => void openSnap()}
                disabled={snapLoading}
                className='mt-5 min-h-12 w-full rounded-full border border-white bg-white px-6 text-sm font-semibold text-black outline-none transition-[border-color,background-color,box-shadow] duration-300 hover:border-fuchsia-300 hover:bg-fuchsia-300 hover:shadow-[0_12px_34px_rgba(217,70,239,0.18)] focus-visible:ring-2 focus-visible:ring-fuchsia-400/70 disabled:cursor-wait disabled:opacity-60'
              >
                {snapLoading ? 'Membuka Snap...' : 'Buka pembayaran Midtrans'}
              </button>
              <p className='mt-5 inline-flex items-center gap-2 text-xs text-white/[0.4]'>
                <span
                  aria-hidden='true'
                  className='h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.7)] motion-reduce:animate-none'
                />
                Status pembayaran diperiksa otomatis
              </p>
            </>
          )}

          {/* STATE 2: PAID (Pembayaran Berhasil) */}
          {status === 'PAID' && (
            <div className='py-4'>
              {/* Animasi Lottie Sukses */}
              <LottiePlayer animationPath='/animations/success.json' />

              <h2
                id='payment-modal-title'
                className='mt-4 text-[26px] font-medium tracking-[-0.035em] text-white'
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
                <p className='mt-4 break-all rounded-[18px] border border-emerald-400/20 bg-emerald-400/[0.06] p-4 font-mono text-sm text-white/[0.78]'>
                  {sn}
                </p>
              )}
              <button
                type='button'
                onClick={goToOrderCheck}
                className='mt-6 min-h-12 w-full rounded-full border border-white bg-white px-6 text-sm font-semibold text-black outline-none transition-colors hover:bg-fuchsia-300 focus-visible:ring-2 focus-visible:ring-fuchsia-400/70'
              >
                Tutup &amp; Cek Pesanan
              </button>
            </div>
          )}

          {/* STATE 3: FAILED (Transaksi Gagal / Expired) */}
          {status === 'FAILED' && (
            <div className='py-4'>
              {/* Animasi Lottie Gagal/Error */}
              <LottiePlayer animationPath='/animations/error.json' />

              <h2
                id='payment-modal-title'
                className='mt-4 text-[26px] font-medium tracking-[-0.035em] text-white'
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
                className='mt-6 min-h-12 w-full rounded-full border border-white/[0.1] bg-white/[0.045] px-6 text-sm font-semibold text-white outline-none transition-colors hover:bg-fuchsia-400/[0.1] focus-visible:ring-2 focus-visible:ring-fuchsia-400/70'
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
