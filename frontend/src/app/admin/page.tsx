import { redirect } from 'next/navigation'

export default function AdminPage() {
  // Langsung tendang ke dashboard otomatis
  redirect('/admin/dashboard')
}