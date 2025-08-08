'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { StreamingResponse } from '@/components/chat/StreamingResponse'
import { Send, LogOut, Video, Image, FileText, Loader2 } from 'lucide-react'

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface GenerationResult {
  script: string
  images: string[]
  video?: string
  status: 'generating' | 'completed' | 'error'
}

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

export default function ChatPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null)
  const [streamingScript, setStreamingScript] = useState('')
  const [streamingImages, setStreamingImages] = useState<string[]>([])
  const [currentStatus, setCurrentStatus] = useState('')
  const [currentStep, setCurrentStep] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSSEMessage = (event: SSEEvent) => {
    switch (event.type) {
      case 'connection':
        console.log('Connected to stream')
        break
      case 'status':
        setCurrentStatus(event.message || '')
        setCurrentStep(event.step || '')
        break
      case 'script_chunk':
        setStreamingScript(prev => prev + (event.content || ''))
        break
      case 'image':
        if (event.url) {
          setStreamingImages(prev => {
            const newImages = [...prev]
            newImages[event.index || 0] = event.url!
            return newImages
          })
        }
        break
      case 'complete':
        setCurrentStatus('Generation completed!')
        setGenerationResult({
          script: streamingScript,
          images: streamingImages,
          video: event.video,
          status: 'completed'
        })
        setIsGenerating(false)
        
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: 'I\'ve successfully generated your video content! Check out the results below.',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMessage])
        break
      case 'error':
        setCurrentStatus('Error occurred')
        setIsGenerating(false)
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: 'Sorry, there was an error generating your video. Please try again.',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
        break
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isGenerating) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    }

    const ideaToProcess = inputValue
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsGenerating(true)
    setGenerationResult(null)
    setStreamingScript('')
    setStreamingImages([])
    setCurrentStatus('Initializing...')
    setCurrentStep('')

    try {
      // Start SSE stream
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idea: ideaToProcess,
          userId: session?.user?.email
        })
      })

      if (!response.ok) {
        throw new Error('Failed to start generation')
      }

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
                handleSSEMessage(data)
              } catch (err) {
                console.error('Failed to parse SSE message:', err)
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Generation error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, there was an error generating your video. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
      setIsGenerating(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Video className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="ml-3">
                <h1 className="text-xl font-semibold text-gray-900">VideoGen</h1>
                <p className="text-sm text-gray-500">AI Video Generation</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Welcome, {session.user?.name}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chat Interface */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border h-[600px] flex flex-col">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Video Idea Chat</h2>
                <p className="text-sm text-gray-600">Describe your video idea and I'll generate script, images, and video for you</p>
              </div>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-gray-500 mt-20">
                    <Video className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">Start Your Video Creation</p>
                    <p className="text-sm">Tell me about your marketing video idea and I'll help bring it to life!</p>
                  </div>
                )}
                
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                
                {isGenerating && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 text-gray-900 max-w-xs lg:max-w-md px-4 py-2 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <p className="text-sm">{currentStatus || 'Starting generation...'}</p>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Input */}
              <div className="p-4 border-t">
                <div className="flex space-x-2">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Describe your video idea..."
                    disabled={isGenerating}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isGenerating}
                    size="sm"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Generation Results */}
          {(isGenerating || generationResult) && (
            <div className="space-y-6">
              {/* Real-time Streaming Results */}
              {isGenerating && (
                <div className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
                  {/* Status */}
                  {currentStatus && (
                    <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span className="text-sm font-medium text-gray-900">{currentStatus}</span>
                    </div>
                  )}

                  {/* Script Section */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Generated Script</h3>
                    </div>
                    {streamingScript ? (
                      <div className="bg-gray-50 rounded-md p-4">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{streamingScript}</p>
                        <div className="inline-block w-2 h-4 bg-blue-600 animate-pulse ml-1"></div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-md p-4 flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        <p className="text-gray-500 text-sm">Waiting for script generation...</p>
                      </div>
                    )}
                  </div>

                  {/* Images Section */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Image className="h-5 w-5 text-green-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Generated Images</h3>
                    </div>
                    {streamingImages.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {streamingImages.map((image, index) => (
                          <div key={index} className="relative">
                            <img
                              src={image}
                              alt={`Generated image ${index + 1}`}
                              className="w-full h-24 object-cover rounded-md"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-md p-4 flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        <p className="text-gray-500 text-sm">Waiting for image generation...</p>
                      </div>
                    )}
                  </div>

                  {/* Video Section */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Video className="h-5 w-5 text-purple-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Generated Video</h3>
                    </div>
                    <div className="bg-gray-50 rounded-md p-8 text-center">
                      <div className="flex flex-col items-center space-y-2">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        <p className="text-gray-500 text-sm">Processing video...</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Final Results */}
              {generationResult && generationResult.status === 'completed' && (
                <div className="space-y-6">
                  {/* Script */}
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="flex items-center mb-4">
                      <FileText className="h-5 w-5 text-blue-600 mr-2" />
                      <h3 className="text-lg font-semibold text-gray-900">Generated Script</h3>
                    </div>
                    <div className="bg-gray-50 rounded-md p-4">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{generationResult.script}</p>
                    </div>
                  </div>
                  
                  {/* Images */}
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="flex items-center mb-4">
                      <Image className="h-5 w-5 text-green-600 mr-2" />
                      <h3 className="text-lg font-semibold text-gray-900">Generated Images</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {generationResult.images.map((image, index) => (
                        <img
                          key={index}
                          src={image}
                          alt={`Generated image ${index + 1}`}
                          className="w-full h-24 object-cover rounded-md"
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Video */}
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="flex items-center mb-4">
                      <Video className="h-5 w-5 text-purple-600 mr-2" />
                      <h3 className="text-lg font-semibold text-gray-900">Generated Video</h3>
                    </div>
                    {generationResult.video ? (
                      <video
                        src={generationResult.video}
                        controls
                        className="w-full rounded-md"
                      >
                        Your browser does not support the video tag.
                      </video>
                    ) : (
                      <div className="bg-gray-50 rounded-md p-8 text-center">
                        <Video className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">Video processing completed but no video available</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
