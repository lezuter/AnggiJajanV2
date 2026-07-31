'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
).replace(/\/+$/, '')

export const useApi = () => {
  const router = useRouter()

  const fetchWithAuth = useCallback(
    async (endpoint: string, options: RequestInit = {}) => {
      const token = localStorage.getItem('token')
      const normalizedEndpoint = endpoint.startsWith('/')
        ? endpoint
        : `/${endpoint}`

      const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}${normalizedEndpoint}`,
          {
            ...options,
            headers
          }
        )

        if (response.status === 401) {
          localStorage.removeItem('token')
          router.push('/admin/login')
          throw new Error('Sesi habis. Silakan login kembali.')
        }

        return response
      } catch (error) {
        console.error('API Error:', error)
        throw error
      }
    },
    [router]
  )

  const get = useCallback(
    (endpoint: string) => fetchWithAuth(endpoint),
    [fetchWithAuth]
  )

  const post = useCallback(
    (endpoint: string, body: unknown) =>
      fetchWithAuth(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
      }),
    [fetchWithAuth]
  )

  const put = useCallback(
    (endpoint: string, body: unknown) =>
      fetchWithAuth(endpoint, {
        method: 'PUT',
        body: JSON.stringify(body)
      }),
    [fetchWithAuth]
  )

  const patch = useCallback(
    (endpoint: string, body: unknown) =>
      fetchWithAuth(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(body)
      }),
    [fetchWithAuth]
  )

  const del = useCallback(
    (endpoint: string) => fetchWithAuth(endpoint, { method: 'DELETE' }),
    [fetchWithAuth]
  )

  return { get, post, put, patch, delete: del }
}
