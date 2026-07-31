import type { Metadata } from 'next'
import Link from 'next/link'

import HomePage from '@/app/page'
import CyberneticGridShader from '@/components/ui/cybernetic-grid-shader'

import styles from './violet-theme.module.css'

export const metadata: Metadata = {
  title: 'Violet Theme Demo | Anggijajan',
  description: 'Eksplorasi tema visual Violet untuk Anggijajan V2.'
}

export default function VioletThemeDemoPage () {
  return (
    <div
      data-theme-demo='violet'
      className={styles.violetTheme}
    >
      <aside
        className={styles.demoIndicator}
        aria-label='Kontrol halaman demo tema Violet'
      >
        <span className={styles.demoLabel}>Violet theme demo</span>
        <Link
          href='/'
          className={styles.backLink}
        >
          Kembali ke halaman utama
        </Link>
      </aside>

      <div
        className={styles.shaderLayer}
        aria-hidden='true'
      >
        <CyberneticGridShader className={styles.shaderCanvas} />
        <div className={styles.shaderFade} />
      </div>

      <div className={styles.pageContent}>
        <HomePage />
      </div>
    </div>
  )
}
