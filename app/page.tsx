'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Generate a random user ID and redirect to chat
    const randomUserId = 'user_' + Math.random().toString(36).substr(2, 9)
    localStorage.setItem('userId', randomUserId)
    router.push('/chat')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )
}
