'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface PaymentData {
  invoice_id?: string
  merchant_ref?: string
  merchant_order_id?: string
  reference?: string
  amount?: number
  base_price?: number
  customer_surcharge?: number
  estimated_fee?: number
  payment_method?: string
  payment_name?: string
  payment_provider?: string
  game_name?: string
  product_name?: string
  product_image?: string
  user_id?: string
  zone_id?: string
  quantity?: number
  contact_info?: string
  promo_code?: string
  qr_string?: string
  qr_url?: string
  va_number?: string
  va_bank?: string
  biller_code?: string
  bill_key?: string
  deeplink_url?: string
  payment_code?: string
  expiry_time?: string
  created_at?: string
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
      if (anim) anim.destroy()
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
  if (!amount || amount <= 0) return 'Rp 0'
  return `Rp ${amount.toLocaleString('id-ID')}`
}

function getExpiryTimestamp (expiryTime?: string) {
  if (!expiryTime) return null
  const timestamp = Date.parse(expiryTime)
  return Number.isNaN(timestamp) ? null : timestamp
}

export default function PaymentModal ({
  isOpen,
  onClose,
  data
}: PaymentModalProps) {
  const router = useRouter()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const redirectedRef = useRef(false)

  const [status, setStatus] = useState<PaymentStatus>('UNPAID')
  const [sn, setSn] = useState('')
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [timeLeft, setTimeLeft] = useState(900)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Accordion open states
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    transaksi: false,
    pembeli: false,
    produk: false,
    pembayaran: false
  })

  const toggleAccordion = (key: string) => {
    setOpenAccordions(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleCopy = (text: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    }
  }

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

  const goToOrderCheck = useCallback(() => {
    if (redirectedRef.current) return
    redirectedRef.current = true
    onClose()
    router.push('/cek-pesanan/')
  }, [onClose, router])

  // Countdown timer
  useEffect(() => {
    if (!isOpen || status !== 'UNPAID') return

    if (!expiryTimestamp) {
      setTimeLeft(900)
      return
    }

    const updateCountdown = () => {
      const remainingMilliseconds = expiryTimestamp - Date.now()
      const remainingSeconds = Math.max(0, Math.ceil(remainingMilliseconds / 1000))
      setTimeLeft(remainingSeconds)

      if (remainingSeconds <= 0) {
        setStatus('FAILED')
      }
    }

    updateCountdown()
    const interval = window.setInterval(updateCountdown, 1000)

    return () => window.clearInterval(interval)
  }, [isOpen, status, expiryTimestamp])

  useEffect(() => {
    if (!isOpen) return
    setStatus('UNPAID')
    setSn('')
    redirectedRef.current = false
    setCopiedKey(null)
  }, [isOpen])

  // Polling status transaksi ke backend
  const checkTransactionStatus = useCallback(async () => {
    if (!merchantReference) return

    setCheckingStatus(true)
    try {
      const referenceQuery = data?.reference
        ? `?reference=${encodeURIComponent(data.reference)}`
        : ''

      const response = await fetch(
        `${API_BASE_URL}/transaction/${encodeURIComponent(
          merchantReference
        )}${referenceQuery}`,
        { cache: 'no-store' }
      )

      if (response.ok) {
        const result = (await response.json()) as TransactionStatusResponse

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
      }
    } catch (error) {
      console.error('Gagal memeriksa status transaksi:', error)
    } finally {
      setCheckingStatus(false)
    }
  }, [data?.reference, merchantReference])

  useEffect(() => {
    if (!isOpen || !data || !merchantReference || status !== 'UNPAID') return

    const interval = window.setInterval(() => {
      void checkTransactionStatus()
    }, 3000)

    return () => window.clearInterval(interval)
  }, [isOpen, data, merchantReference, status, checkTransactionStatus])

  if (!isOpen || !data) return null

  const targetAccountDisplay = data.zone_id
    ? `${data.user_id} (${data.zone_id})`
    : data.user_id || '-'

  const qrCodeUrl =
    data.qr_url ||
    (data.qr_string
      ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
          data.qr_string
        )}`
      : null)

  const isQRIS =
    data.payment_method?.toLowerCase().includes('qris') || Boolean(qrCodeUrl)
  const isVA = Boolean(data.va_number)
  const isMandiri = Boolean(data.bill_key && data.biller_code)
  const isEWallet = Boolean(data.deeplink_url)
  const isRetail = Boolean(data.payment_code)

  const unitPrice = data.base_price || 0
  const feeAmount = data.customer_surcharge ?? data.estimated_fee ?? 0
  const totalPayAmount = data.amount || 0

  return (
    <div
      className='fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-black/[0.82] p-3 backdrop-blur-md sm:items-center sm:p-6 outline-none focus:outline-none focus-visible:outline-none'
      role='presentation'
    >
      <section
        role='dialog'
        aria-modal='true'
        aria-labelledby='payment-modal-title'
        className='relative w-full max-w-lg overflow-hidden rounded-[28px] border border-white/[0.1] bg-black/[0.9] p-5 text-white shadow-[0_22px_70px_rgba(0,0,0,0.6)] backdrop-blur-xl backdrop-saturate-150 outline-none focus:outline-none focus-visible:outline-none sm:p-7 max-h-[90vh] flex flex-col'
      >
        {/* Tombol Tutup X */}
        <button
          ref={closeButtonRef}
          type='button'
          onClick={onClose}
          aria-label='Tutup dialog pembayaran'
          className='absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/[0.62] outline-none focus:outline-none focus-visible:outline-none transition-colors hover:border-white/[0.2] hover:bg-white/[0.08] hover:text-white'
        >
          <svg aria-hidden='true' viewBox='0 0 24 24' fill='none' className='h-4 w-4'>
            <path d='m7 7 10 10M17 7 7 17' stroke='currentColor' strokeLinecap='round' strokeWidth='1.8' />
          </svg>
        </button>

        {/* ========================================================
            STATE 1: UNPAID (Payment In Progress UI)
           ======================================================== */}
        {status === 'UNPAID' && (
          <div className='overflow-y-auto pr-1 space-y-5 custom-scrollbar'>
            {/* 1. HEADER / INVOICE ID (PALING ATAS) */}
            <div className='flex items-center justify-between border-b border-white/[0.08] pb-3.5 pr-8'>
              <div className='min-w-0'>
                <p className='font-mono text-[10px] uppercase tracking-[0.12em] text-white/[0.42]'>
                  ID Transaksi
                </p>
                <div className='mt-0.5 flex items-center gap-2'>
                  <span className='font-mono text-sm font-semibold text-white truncate max-w-[220px] sm:max-w-[280px]'>
                    {merchantReference || '-'}
                  </span>
                  {merchantReference && (
                    <button
                      type='button'
                      onClick={() => handleCopy(merchantReference, 'invoice')}
                      className='inline-flex items-center gap-1 rounded-md border border-white/[0.1] bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-white/[0.7] hover:bg-white/[0.1] transition-colors outline-none focus:outline-none focus-visible:outline-none'
                      aria-label='Salin Invoice ID'
                    >
                      {copiedKey === 'invoice' ? (
                        <span className='text-emerald-400 flex items-center gap-1'>
                          ✓ Tersalin
                        </span>
                      ) : (
                        <span>Salin</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 2. STEPPER: [ Bayar ] → [ Proses ] → [ Selesai ] */}
            <div className='flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3'>
              {/* Step 1: Bayar (Active) */}
              <div className='flex items-center gap-2'>
                <span className='flex h-5 w-5 items-center justify-center rounded-full border border-cyan-400/50 bg-cyan-400/20 font-mono text-[10px] font-bold text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)]'>
                  1
                </span>
                <span className='font-mono text-xs font-semibold text-white'>
                  Bayar
                </span>
              </div>

              <div className='h-px flex-1 mx-3 bg-gradient-to-r from-cyan-400/40 to-white/[0.1]' />

              {/* Step 2: Proses */}
              <div className='flex items-center gap-2'>
                <span className='flex h-5 w-5 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.03] font-mono text-[10px] text-white/40'>
                  2
                </span>
                <span className='font-mono text-xs text-white/40'>
                  Proses
                </span>
              </div>

              <div className='h-px flex-1 mx-3 bg-white/[0.1]' />

              {/* Step 3: Selesai */}
              <div className='flex items-center gap-2'>
                <span className='flex h-5 w-5 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.03] font-mono text-[10px] text-white/40'>
                  3
                </span>
                <span className='font-mono text-xs text-white/40'>
                  Selesai
                </span>
              </div>
            </div>

            {/* 3. PAYMENT CONTAINER UTAMA */}
            <div className='rounded-[22px] border border-white/[0.08] bg-black/[0.4] p-4 sm:p-5 space-y-4'>
              {/* Countdown Prominent */}
              <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-amber-300/25 bg-amber-400/[0.06] p-3'>
                <div className='flex items-center gap-2'>
                  <span className='h-2 w-2 rounded-full bg-amber-400 animate-pulse' aria-hidden='true' />
                  <div>
                    <p className='text-xs font-medium text-amber-200'>
                      Selesaikan pembayaran sebelum batas waktu berakhir
                    </p>
                  </div>
                </div>
                <div className='font-mono text-base font-bold text-amber-100 tabular-nums self-end sm:self-auto'>
                  {formatTime(timeLeft)}
                </div>
              </div>

              {/* Detail Produk & Total Tagihan (Desktop: 2 Kolom, Mobile: Stacked) */}
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-white/[0.08] pb-4 pt-1'>
                {/* Kolom Kiri: Produk */}
                <div className='flex items-center gap-3'>
                  {data.product_image && (
                    <div className='h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-center p-1'>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={data.product_image}
                        alt={data.product_name || 'Produk'}
                        className='h-full w-full object-contain'
                      />
                    </div>
                  )}
                  <div className='min-w-0'>
                    <p className='text-[11px] font-medium text-white/50 truncate'>
                      {data.game_name || 'Produk Game'}
                    </p>
                    <p className='text-sm font-semibold text-white leading-snug'>
                      {data.product_name || '-'}
                      {data.quantity && data.quantity > 1 && (
                        <span className='ml-1.5 font-mono text-xs font-bold text-cyan-300'>
                          {data.quantity}x
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Kolom Kanan: Total Tagihan */}
                <div className='text-left sm:text-right flex flex-col justify-center'>
                  <p className='font-mono text-[10px] uppercase tracking-[0.1em] text-white/50'>
                    Total Tagihan
                  </p>
                  <p className='text-xl sm:text-2xl font-bold tracking-tight text-cyan-400'>
                    {formatIDR(totalPayAmount)}
                  </p>
                </div>
              </div>

              {/* 4. PAYMENT METHOD & DYNAMIC CONTENT */}
              <div className='space-y-3 pt-1'>
                <div className='flex items-center justify-between gap-2'>
                  <span className='font-mono text-[10px] uppercase tracking-wider text-white/50'>
                    Metode Pembayaran
                  </span>
                  <span className='text-sm font-semibold text-white'>
                    {paymentName}
                  </span>
                </div>

                {/* A. QRIS Renderer */}
                {isQRIS && qrCodeUrl && (
                  <div className='mt-3 flex flex-col items-center justify-center rounded-2xl border border-white/[0.1] bg-white p-4 shadow-lg'>
                    <div className='mb-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-800'>
                      <span>QRIS</span>
                      <span className='text-[8px] font-normal text-slate-500'>
                        Standar Pembayaran Nasional
                      </span>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrCodeUrl}
                      alt='QRIS Code'
                      className='h-44 w-44 object-contain rounded-lg'
                    />
                    <p className='mt-2 text-[10px] font-medium text-slate-600 text-center'>
                      Scan menggunakan GoPay, OVO, DANA, ShopeePay, atau Mobile Banking
                    </p>
                  </div>
                )}

                {/* B. Virtual Account Renderer (BCA, BNI, BRI, Permata) */}
                {isVA && (
                  <div className='rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5'>
                    <p className='text-xs text-white/50'>
                      Nomor Virtual Account {data.va_bank ? `(${data.va_bank.toUpperCase()})` : ''}
                    </p>
                    <div className='mt-1 flex items-center justify-between gap-2'>
                      <span className='font-mono text-base sm:text-lg font-bold text-white tracking-wider break-all'>
                        {data.va_number}
                      </span>
                      <button
                        type='button'
                        onClick={() => handleCopy(data.va_number || '', 'va')}
                        className='shrink-0 rounded-lg border border-white/[0.15] bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/[0.15] transition-colors outline-none focus:outline-none focus-visible:outline-none'
                      >
                        {copiedKey === 'va' ? '✓ Tersalin' : 'Salin'}
                      </button>
                    </div>
                  </div>
                )}

                {/* C. Mandiri Bill Payment Renderer */}
                {isMandiri && (
                  <div className='rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5 space-y-2.5 text-left'>
                    <div>
                      <p className='text-[10px] text-white/50'>Kode Perusahaan (Biller Code)</p>
                      <span className='font-mono text-sm font-bold text-white'>{data.biller_code}</span>
                    </div>
                    <div>
                      <p className='text-[10px] text-white/50'>Kode Tagihan (Bill Key)</p>
                      <div className='flex items-center justify-between gap-2'>
                        <span className='font-mono text-sm font-bold text-white'>{data.bill_key}</span>
                        <button
                          type='button'
                          onClick={() => handleCopy(data.bill_key || '', 'billkey')}
                          className='rounded-lg border border-white/[0.15] bg-white/[0.08] px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/[0.15] outline-none focus:outline-none focus-visible:outline-none'
                        >
                          {copiedKey === 'billkey' ? '✓ Tersalin' : 'Salin'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* D. E-Wallet Deeplink Renderer */}
                {isEWallet && (
                  <div className='rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5 text-center space-y-2'>
                    <p className='text-xs text-white/60'>
                      Bayar langsung melalui aplikasi {paymentName}
                    </p>
                    <a
                      href={data.deeplink_url}
                      className='flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-fuchsia-300 bg-fuchsia-400/20 px-5 text-xs font-semibold text-fuchsia-100 hover:bg-fuchsia-400/30 transition-all outline-none focus:outline-none focus-visible:outline-none'
                    >
                      Bayar via Aplikasi {paymentName}
                    </a>
                  </div>
                )}

                {/* E. Retail Store Renderer */}
                {isRetail && (
                  <div className='rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5'>
                    <p className='text-xs text-white/50'>Kode Pembayaran Kasir</p>
                    <div className='mt-1 flex items-center justify-between gap-2'>
                      <span className='font-mono text-base sm:text-lg font-bold text-white tracking-wider'>
                        {data.payment_code}
                      </span>
                      <button
                        type='button'
                        onClick={() => handleCopy(data.payment_code || '', 'retail')}
                        className='rounded-lg border border-white/[0.15] bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/[0.15] outline-none focus:outline-none focus-visible:outline-none'
                      >
                        {copiedKey === 'retail' ? '✓ Tersalin' : 'Salin'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Tombol Khusus Download QRIS (HANYA UNTUK QRIS) */}
                {isQRIS && qrCodeUrl && (
                  <a
                    href={qrCodeUrl}
                    download={`QRIS-${merchantReference}.png`}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-4 text-xs font-semibold text-white/80 hover:bg-white/[0.08] hover:text-white transition-all outline-none focus:outline-none focus-visible:outline-none'
                  >
                    Download QRIS
                  </a>
                )}
              </div>
            </div>

            {/* ========================================================
                ACCORDION DETAILS (COLLAPSIBLE SECTIONS)
               ======================================================== */}
            <div className='space-y-2 pt-1'>
              {/* 5. Detail Transaksi */}
              <div className='rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden'>
                <button
                  type='button'
                  onClick={() => toggleAccordion('transaksi')}
                  className='flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold text-white/80 hover:text-white transition-colors outline-none focus:outline-none focus-visible:outline-none'
                >
                  <span>Detail Transaksi</span>
                  <span className='text-xs text-white/40'>
                    {openAccordions.transaksi ? '▲' : '▼'}
                  </span>
                </button>
                {openAccordions.transaksi && (
                  <div className='border-t border-white/[0.06] p-3.5 space-y-2 text-xs'>
                    <div className='flex justify-between gap-4'>
                      <span className='text-white/45'>Status Transaksi</span>
                      <span className='font-medium text-amber-300'>Menunggu Pembayaran</span>
                    </div>
                    <div className='flex justify-between gap-4'>
                      <span className='text-white/45'>ID Transaksi</span>
                      <span className='font-mono text-white/80 break-all'>{merchantReference || '-'}</span>
                    </div>
                    <div className='flex justify-between gap-4'>
                      <span className='text-white/45'>Waktu Dibuat</span>
                      <span className='text-white/80'>{data.created_at ? new Date(data.created_at).toLocaleString('id-ID') : '-'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Detail Pembeli */}
              <div className='rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden'>
                <button
                  type='button'
                  onClick={() => toggleAccordion('pembeli')}
                  className='flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold text-white/80 hover:text-white transition-colors outline-none focus:outline-none focus-visible:outline-none'
                >
                  <span>Detail Pembeli</span>
                  <span className='text-xs text-white/40'>
                    {openAccordions.pembeli ? '▲' : '▼'}
                  </span>
                </button>
                {openAccordions.pembeli && (
                  <div className='border-t border-white/[0.06] p-3.5 space-y-2 text-xs'>
                    <div className='flex justify-between gap-4'>
                      <span className='text-white/45'>User ID</span>
                      <span className='font-medium text-white/80'>{targetAccountDisplay}</span>
                    </div>
                    {data.contact_info && (
                      <div className='flex justify-between gap-4'>
                        <span className='text-white/45'>Kontak</span>
                        <span className='font-medium text-white/80 break-all'>{data.contact_info}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 7. Detail Produk */}
              <div className='rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden'>
                <button
                  type='button'
                  onClick={() => toggleAccordion('produk')}
                  className='flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold text-white/80 hover:text-white transition-colors outline-none focus:outline-none focus-visible:outline-none'
                >
                  <span>Detail Produk</span>
                  <span className='text-xs text-white/40'>
                    {openAccordions.produk ? '▲' : '▼'}
                  </span>
                </button>
                {openAccordions.produk && (
                  <div className='border-t border-white/[0.06] p-3.5 space-y-2 text-xs'>
                    <div className='flex justify-between gap-4'>
                      <span className='text-white/45'>Katalog / Game</span>
                      <span className='font-medium text-white/80'>{data.game_name || '-'}</span>
                    </div>
                    <div className='flex justify-between gap-4'>
                      <span className='text-white/45'>Item Produk</span>
                      <span className='font-medium text-white/80'>{data.product_name || '-'}</span>
                    </div>
                    <div className='flex justify-between gap-4'>
                      <span className='text-white/45'>Jumlah</span>
                      <span className='font-mono font-medium text-white/80'>{data.quantity || 1}x</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 8. Detail Pembayaran */}
              <div className='rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden'>
                <button
                  type='button'
                  onClick={() => toggleAccordion('pembayaran')}
                  className='flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold text-white/80 hover:text-white transition-colors outline-none focus:outline-none focus-visible:outline-none'
                >
                  <span>Detail Pembayaran</span>
                  <span className='text-xs text-white/40'>
                    {openAccordions.pembayaran ? '▲' : '▼'}
                  </span>
                </button>
                {openAccordions.pembayaran && (
                  <div className='border-t border-white/[0.06] p-3.5 space-y-2 text-xs'>
                    <div className='flex justify-between gap-4'>
                      <span className='text-white/45'>Harga Satuan</span>
                      <span className='text-white/80'>{formatIDR(unitPrice)}</span>
                    </div>
                    <div className='flex justify-between gap-4'>
                      <span className='text-white/45'>Biaya Layanan (Fee)</span>
                      <span className={feeAmount > 0 ? 'text-amber-300' : 'text-emerald-300'}>
                        {feeAmount > 0 ? formatIDR(feeAmount) : 'Rp 0'}
                      </span>
                    </div>
                    {data.promo_code && (
                      <div className='flex justify-between gap-4'>
                        <span className='text-white/45'>Kode Promo</span>
                        <span className='font-mono text-fuchsia-300'>{data.promo_code}</span>
                      </div>
                    )}
                    <div className='border-t border-white/[0.06] pt-2 mt-1 flex justify-between gap-4 font-semibold text-sm'>
                      <span className='text-white'>Total Bayar</span>
                      <span className='text-cyan-400'>{formatIDR(totalPayAmount)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tombol Cek Status & Auto-Polling Status */}
            <div className='pt-2 space-y-3'>
              <button
                type='button'
                onClick={() => void checkTransactionStatus()}
                disabled={checkingStatus}
                className='flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-white bg-white px-6 text-sm font-semibold text-black outline-none focus:outline-none focus-visible:outline-none transition-all duration-300 hover:border-fuchsia-300 hover:bg-fuchsia-300 hover:shadow-[0_12px_34px_rgba(217,70,239,0.18)] disabled:opacity-60'
              >
                {checkingStatus ? 'Memeriksa Status...' : 'Cek Status Pembayaran'}
              </button>

              <p className='text-center text-xs text-white/40 flex items-center justify-center gap-2'>
                <span className='h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse' aria-hidden='true' />
                Status pembayaran diperiksa otomatis
              </p>
            </div>
          </div>
        )}

        {/* ========================================================
            STATE 2: PAID (Pembayaran Berhasil)
           ======================================================== */}
        {status === 'PAID' && (
          <div className='py-4 text-center space-y-4'>
            <LottiePlayer animationPath='/animations/success.json' />

            <div>
              <h2 id='payment-modal-title' className='text-2xl font-medium tracking-tight text-white'>
                Pembayaran Berhasil
              </h2>
              <p className='mt-1.5 text-sm text-white/50'>
                Top up kamu sedang diproses oleh sistem.
              </p>
            </div>

            {sn && (
              <div className='rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 text-left space-y-1'>
                <p className='font-mono text-[10px] uppercase tracking-wider text-emerald-300/70'>
                  Serial Number (SN)
                </p>
                <p className='font-mono text-sm font-semibold text-white break-all'>
                  {sn}
                </p>
              </div>
            )}

            <button
              type='button'
              onClick={goToOrderCheck}
              className='mt-4 min-h-12 w-full rounded-full border border-white bg-white px-6 text-sm font-semibold text-black outline-none focus:outline-none focus-visible:outline-none transition-colors hover:bg-fuchsia-300'
            >
              Tutup &amp; Cek Pesanan
            </button>
          </div>
        )}

        {/* ========================================================
            STATE 3: FAILED (Transaksi Gagal / Expired)
           ======================================================== */}
        {status === 'FAILED' && (
          <div className='py-4 text-center space-y-4'>
            <LottiePlayer animationPath='/animations/error.json' />

            <div>
              <h2 id='payment-modal-title' className='text-2xl font-medium tracking-tight text-white'>
                Transaksi Gagal
              </h2>
              <p className='mt-1.5 text-sm text-white/50'>
                Batas waktu pembayaran telah berakhir atau transaksi dibatalkan.
              </p>
            </div>

            <button
              type='button'
              onClick={onClose}
              className='mt-4 min-h-12 w-full rounded-full border border-white/[0.1] bg-white/[0.045] px-6 text-sm font-semibold text-white outline-none focus:outline-none focus-visible:outline-none transition-colors hover:bg-fuchsia-400/[0.1]'
            >
              Tutup
            </button>
          </div>
        )}
      </section>
    </div>
  )
}