'use client'

import { useEffect, useRef, useState } from 'react'

interface SSEEvent {
  type: 'connection' | 'status' | 'script_chunk' | 'image' | 'complete' | 'error'
  message?: string
  content?: string
  url?: string
  index?: number
  step?: string
  video?: string
  isComplete?: boolean
}

interface UseSSEOptions {
  onMessage?: (event: SSEEvent) => void
  onError?: (error: Event) => void
  onOpen?: () => void
  onClose?: () => void
}

export function useSSE(url: string | null, options: UseSSEOptions = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const connect = () => {
    if (!url || eventSourceRef.current) return

    try {
      const eventSource = new EventSource(url)
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        setIsConnected(true)
        setError(null)
        options.onOpen?.()
      }

      eventSource.onmessage = (event) => {
        try {
          const data: SSEEvent = JSON.parse(event.data)
          options.onMessage?.(data)
        } catch (err) {
          console.error('Failed to parse SSE message:', err)
        }
      }

      eventSource.onerror = (event) => {
        setError('Connection error')
        setIsConnected(false)
        options.onError?.(event)
        disconnect()
      }

      eventSource.addEventListener('close', () => {
        setIsConnected(false)
        options.onClose?.()
        disconnect()
      })

    } catch (err) {
      setError('Failed to connect')
      console.error('SSE connection error:', err)
    }
  }

  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsConnected(false)
  }

  const sendMessage = async (data: any) => {
    if (!url) return

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      // The response will be streamed via SSE
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data: SSEEvent = JSON.parse(line.slice(6))
                options.onMessage?.(data)
              } catch (err) {
                console.error('Failed to parse chunk:', err)
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to send message:', err)
      setError('Failed to send message')
    }
  }

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [])

  return {
    isConnected,
    error,
    connect,
    disconnect,
    sendMessage
  }
}
