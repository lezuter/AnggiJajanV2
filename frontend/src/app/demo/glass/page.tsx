import type { Metadata } from 'next'
import Link from 'next/link'

import HomePage from '@/app/page'

import styles from './glass-theme.module.css'

export const metadata: Metadata = {
  title: 'Glass Theme Demo | Anggijajan',
  description: 'Demo material visual Glass untuk homepage Anggijajan V2.'
}

export default function GlassThemeDemoPage () {
  return (
    <div
      data-theme-demo='glass'
      className={styles.glassTheme}
    >
      <aside
        className={styles.demoIndicator}
        aria-label='Kontrol halaman demo tema Glass'
      >
        <span className={styles.demoLabel}>Glass theme demo</span>
        <Link
          href='/'
          className={styles.backLink}
        >
          Kembali ke halaman utama
        </Link>
      </aside>

      <HomePage />
    </div>
  )
}
