export interface MidtransSnapResult {
  order_id?: string
  transaction_status?: string
}

export interface MidtransSnapCallbacks {
  onSuccess?: (result: MidtransSnapResult) => void
  onPending?: (result: MidtransSnapResult) => void
  onError?: (result: MidtransSnapResult) => void
  onClose?: () => void
}

interface MidtransPaymentConfig {
  provider: 'midtrans'
  mode: 'sandbox' | 'production'
  client_key: string
  snap_script_url: string
}

declare global {
  interface Window {
    snap?: {
      pay: (token: string, callbacks: MidtransSnapCallbacks) => void
    }
  }
}

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
).replace(/\/+$/, '')

let paymentConfigPromise: Promise<MidtransPaymentConfig> | null = null
let snapScriptPromise: Promise<void> | null = null
let snapScriptIdentity = ''

function validatePaymentConfig (value: unknown): MidtransPaymentConfig {
  if (!value || typeof value !== 'object') {
    throw new Error('Konfigurasi pembayaran dari server tidak valid.')
  }

  const config = value as Partial<MidtransPaymentConfig>
  let scriptURL: URL
  try {
    scriptURL = new URL(config.snap_script_url || '')
  } catch {
    throw new Error('Konfigurasi pembayaran dari server tidak valid.')
  }
  if (
    config.provider !== 'midtrans' ||
    (config.mode !== 'sandbox' && config.mode !== 'production') ||
    typeof config.client_key !== 'string' ||
    config.client_key.trim() === '' ||
    scriptURL.protocol !== 'https:'
  ) {
    throw new Error('Konfigurasi pembayaran dari server tidak valid.')
  }

  return {
    provider: config.provider,
    mode: config.mode,
    client_key: config.client_key.trim(),
    snap_script_url: scriptURL.href
  }
}

async function getMidtransPaymentConfig (): Promise<MidtransPaymentConfig> {
  if (paymentConfigPromise) return paymentConfigPromise

  paymentConfigPromise = fetch(`${API_BASE_URL}/payment-config`, {
    cache: 'no-store'
  })
    .then(async response => {
      if (!response.ok) {
        throw new Error('Konfigurasi pembayaran belum tersedia.')
      }
      return validatePaymentConfig(await response.json())
    })
    .catch(error => {
      paymentConfigPromise = null
      throw error
    })

  return paymentConfigPromise
}

function loadMidtransSnapScript (
  config: MidtransPaymentConfig
): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Snap hanya tersedia di browser.'))
  }

  const identity = `${config.snap_script_url}:${config.client_key}`
  const existingScript = document.querySelector<HTMLScriptElement>(
    'script[data-anggijajan-midtrans-snap="true"]'
  )
  const existingMatches =
    existingScript?.src === config.snap_script_url &&
    existingScript.getAttribute('data-client-key') === config.client_key

  if (window.snap && existingMatches) return Promise.resolve()
  if (snapScriptPromise && snapScriptIdentity === identity) {
    return snapScriptPromise
  }

  if (existingScript && !existingMatches) {
    existingScript.remove()
    delete window.snap
  }

  const script = existingMatches
    ? existingScript
    : document.createElement('script')

  snapScriptIdentity = identity
  snapScriptPromise = new Promise<void>((resolve, reject) => {
    const handleLoad = () => {
      script.dataset.snapLoaded = 'true'
      if (window.snap) {
        resolve()
        return
      }
      reject(new Error('Snap.js dimuat tetapi API pembayaran tidak tersedia.'))
    }
    const handleError = () => {
      reject(new Error('Snap.js Midtrans gagal dimuat.'))
    }

    if (existingMatches && script.dataset.snapLoaded === 'true') {
      handleLoad()
      return
    }

    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })

    if (!existingMatches) {
      script.src = config.snap_script_url
      script.async = true
      script.dataset.anggijajanMidtransSnap = 'true'
      script.setAttribute('data-client-key', config.client_key)
      document.body.appendChild(script)
    }
  }).catch(error => {
    if (!window.snap) script.remove()
    snapScriptPromise = null
    snapScriptIdentity = ''
    throw error
  })

  return snapScriptPromise
}

export async function prepareMidtransSnap (): Promise<void> {
  const config = await getMidtransPaymentConfig()
  await loadMidtransSnapScript(config)
}

export async function payWithMidtransSnap (
  token: string,
  callbacks: MidtransSnapCallbacks
): Promise<void> {
  await prepareMidtransSnap()
  if (!window.snap) {
    throw new Error('Snap Midtrans tidak tersedia.')
  }
  window.snap.pay(token, callbacks)
}
