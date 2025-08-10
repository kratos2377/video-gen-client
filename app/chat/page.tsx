'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { StreamingResponse } from '@/components/chat/StreamingResponse'
import { Send, LogOut, Video, Image, FileText, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import {v4 as uuidv4} from 'uuid'


interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface GenerationResult {
  adScript: string[]
  sceneDescription: string[]
  images: string[]
  video?: string
  status: 'generating' | 'completed' | 'error'
}

interface SSEEvent {
  type: 'ai_chat_session_created' | 'ai_processing_started' | 'ai_message_start' | 'ai_ad_script' | 'ai_scene_description' | 'ai_image_generation_started' | 'ai_image_generation_completed' | 'ai_image_generation_error' | 'ai_video_generation_started' | 'ai_video_saved'
  data?: {
    message?: {
      content?: string
      image?: {
        imageBytes: string
      }
      videoPath?: string,
      additionalAttributes?: Record<string, any>
    },

  sessionId?: string
  },

}

export default function ChatPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null)
  const [streamingAdScript, setStreamingAdScript] = useState<string[]>([])
  const [streamingSceneDescription, setStreamingSceneDescription] = useState<string[]>([])
  const [streamingImages, setStreamingImages] = useState<string[]>([])
  const [currentStatus, setCurrentStatus] = useState('')
  const [currentStep, setCurrentStep] = useState('')
  const [activeGenerationStep, setActiveGenerationStep] = useState<'ad_idea' | 'scene' | 'images' | 'video' | null>(null)
  const [collapsedSections, setCollapsedSections] = useState({
    adScript: false,
    sceneDescription: false,
    images: false,
    video: false
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Get or generate user ID
    let storedUserId = localStorage.getItem('userId')
    if (!storedUserId) {
      storedUserId = uuidv4()
      localStorage.setItem('userId', storedUserId)
    }
    setUserId(storedUserId)
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSSEMessage = (event: SSEEvent) => {
    const messageData = event.data?.message || event.message
    
    switch (event.type) {
      case 'ai_chat_session_created':
        setCurrentStatus('Chat Session creation in progress')
        console.log('Chat session created')
        break
      case 'ai_processing_started':
        setCurrentStatus('Chat session is created and processing from AI has started')
        setActiveGenerationStep('ad_idea')
        break
      case 'ai_message_start':
        setCurrentStatus('AI is thinking')
        setActiveGenerationStep('ad_idea')
        break
      case 'ai_ad_script':
        setCurrentStatus('AI is Generating the AD Script')
        setActiveGenerationStep('ad_idea')
        if (messageData?.content) {
          setStreamingAdScript( (prev) => [...prev, messageData.content] )
        }
        break
      case 'ai_scene_description':
        setCurrentStatus('AI AD script is generated and AI is currently generating the Scene Script')
        setActiveGenerationStep('scene')
        if (messageData?.content) {
          setStreamingSceneDescription( (prev) => [...prev, messageData.content] )
        }
        break
      case 'ai_image_generation_started':
        setCurrentStatus('AI Scene Script is generated and Image Generation has started')
        setActiveGenerationStep('images')
        break
      case 'ai_image_generation_completed':
        setCurrentStatus('AI image is generated')
        setActiveGenerationStep('images')
        if (messageData?.image?.imageBytes) {
          const imageUrl = `data:image/jpeg;base64,${messageData.image.imageBytes}`
          setStreamingImages(prev => [...prev, imageUrl])
        }
        break
      case 'ai_image_generation_error':
        setCurrentStatus('Some error occurred while generating image')
        setActiveGenerationStep('images')
        break
      case 'ai_video_generation_started':
        setCurrentStatus('AI Video Generation started')
        setActiveGenerationStep('video')
        break
      case 'ai_video_saved':
        setCurrentStatus('Video is generated')
        setActiveGenerationStep(null)
        setIsGenerating(false)
        
        setGenerationResult({
          adScript: streamingAdScript,
          sceneDescription: streamingSceneDescription,
          images: streamingImages,
          video: messageData?.videoPath,
          status: 'completed'
        })
        
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: 'I\'ve successfully generated your video content! Check out the results below.',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMessage])
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
    setStreamingAdScript([])
    setStreamingSceneDescription([])
    setStreamingImages([])
    setCurrentStatus('')
    setCurrentStep('')
    setActiveGenerationStep(null)

    try {

      const response = await fetch('http://localhost:4000/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: ideaToProcess,
          userId: userId
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

  const toggleSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
                Welcome, {userId}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  localStorage.removeItem('userId')
                  router.push('/')
                }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Reset Session
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-full mx-auto px-4 sm:px-1 lg:px-1 py-1">
        <div className="flex gap-6 h-[calc(100vh-140px)]">
          <div className="min-w-0">
            <div className="bg-white rounded-lg shadow-sm border h-full flex flex-col">
              <div className="p-4 border-b">
                <p className="text-sm text-gray-600">Describe your video idea and I'll generate script, images, and video for you</p>
              </div>
              
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
          

            <div className="max-w-full flex-1">
              <div className="bg-white rounded-lg shadow-sm border h-full flex flex-col">
                <div className="p-4 border-b">
                  <h2 className="text-lg font-semibold text-gray-900">Video Creation</h2>
                  <p className="text-sm text-gray-600">Progress through each step</p>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                  {isGenerating && (
                    <div className="p-4 space-y-4">
                      {currentStatus && (
                        <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                          <span className="text-sm font-medium text-gray-900">{currentStatus}</span>
                        </div>
                      )}

                      <div className={`border rounded-lg p-4 transition-all duration-300 ${
                        activeGenerationStep === 'ad_idea' 
                          ? 'border-blue-500 bg-blue-50 shadow-md' 
                          : streamingAdScript 
                            ? 'border-green-500 bg-green-50' 
                            : 'border-gray-200 bg-gray-50'
                      }`}>
                        <div className="flex items-center space-x-2 mb-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            streamingAdScript 
                              ? 'bg-green-500 text-white' 
                              : activeGenerationStep === 'ad_idea'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-300 text-gray-600'
                          }`}>
                            1
                          </div>
                          <FileText className={`h-4 w-4 ${
                            activeGenerationStep === 'ad_idea' ? 'text-blue-600' : 'text-gray-600'
                          }`} />
                          <h3 className="text-sm font-semibold text-gray-900">Ad Idea Generation</h3>
                        </div>
                
                          <div className="space-y-2">
                            {streamingAdScript.length > 0 ? (
                              <div className="bg-white rounded p-3 max-h-32 overflow-y-auto">
                                {streamingAdScript.map((script, index) => (
                                  <p key={index} className="text-xs text-gray-700 whitespace-pre-wrap mb-2">{script}</p>
                                ))}
                                <div className="inline-block w-1 h-3 bg-blue-600 animate-pulse ml-1"></div>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2 text-gray-600">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <p className="text-xs">Generating ad script...</p>
                              </div>
                            )}
                          </div>
                        
                        {streamingAdScript.length > 0 && activeGenerationStep !== 'ad_idea' && (
                          <div className="text-xs text-green-600 font-medium">✓ Ad Script completed</div>
                        )}
                      </div>

                      <div className={`border rounded-lg p-4 transition-all duration-300 ${
                        activeGenerationStep === 'scene' 
                          ? 'border-orange-500 bg-orange-50 shadow-md' 
                          : streamingSceneDescription 
                            ? 'border-green-500 bg-green-50' 
                            : 'border-gray-200 bg-gray-50'
                      }`}>
                        <div className="flex items-center space-x-2 mb-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            streamingSceneDescription 
                              ? 'bg-green-500 text-white' 
                              : activeGenerationStep === 'scene'
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-300 text-gray-600'
                          }`}>
                            2
                          </div>
                          <FileText className={`h-4 w-4 ${
                            activeGenerationStep === 'scene' ? 'text-orange-600' : 'text-gray-600'
                          }`} />
                          <h3 className="text-sm font-semibold text-gray-900">Scene Generation</h3>
                        </div>
                        {activeGenerationStep === 'scene' && (
                          <div className="space-y-2">
                            {streamingSceneDescription.length > 0 ? (
                              <div className="bg-white rounded p-3 max-h-32 overflow-y-auto">
                                {streamingSceneDescription.map((scene, index) => (
                                  <p key={index} className="text-xs text-gray-700 whitespace-pre-wrap mb-2">{scene}</p>
                                ))}
                                <div className="inline-block w-1 h-3 bg-orange-600 animate-pulse ml-1"></div>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2 text-gray-600">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <p className="text-xs">Generating scene description...</p>
                              </div>
                            )}
                          </div>
                        )}
                        {streamingSceneDescription.length > 0 && activeGenerationStep !== 'scene' && (
                          <div className="text-xs text-green-600 font-medium">✓ Scene Description completed</div>
                        )}
                      </div>

                      <div className={`border rounded-lg p-4 transition-all duration-300 ${
                        activeGenerationStep === 'images' 
                          ? 'border-green-500 bg-green-50 shadow-md' 
                          : streamingImages.length > 0 
                            ? 'border-green-500 bg-green-50' 
                            : 'border-gray-200 bg-gray-50'
                      }`}>
                        <div className="flex items-center space-x-2 mb-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            streamingImages.length > 0 
                              ? 'bg-green-500 text-white' 
                              : activeGenerationStep === 'images'
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-300 text-gray-600'
                          }`}>
                            3
                          </div>
                          <Image className={`h-4 w-4 ${
                            activeGenerationStep === 'images' ? 'text-green-600' : 'text-gray-600'
                          }`} />
                          <h3 className="text-sm font-semibold text-gray-900">Image Generation</h3>
                        </div>
                        {activeGenerationStep === 'images' && (
                          <div className="space-y-2">
                            {streamingImages.length > 0 ? (
                              <div className="grid grid-cols-2 gap-1">
                                {streamingImages.map((image, index) => (
                                  <img
                                    key={index}
                                    src={image}
                                    alt={`Generated image ${index + 1}`}
                                    className="w-full h-16 object-cover rounded"
                                  />
                                ))}
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2 text-gray-600">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <p className="text-xs">Generating images...</p>
                              </div>
                            )}
                          </div>
                        )}
                        {streamingImages.length > 0 && activeGenerationStep !== 'images' && (
                          <div className="text-xs text-green-600 font-medium">✓ Images completed ({streamingImages.length})</div>
                        )}
                      </div>

                      <div className={`border rounded-lg p-4 transition-all duration-300 ${
                        activeGenerationStep === 'video' 
                          ? 'border-purple-500 bg-purple-50 shadow-md' 
                          : 'border-gray-200 bg-gray-50'
                      }`}>
                        <div className="flex items-center space-x-2 mb-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            activeGenerationStep === 'video'
                              ? 'bg-purple-500 text-white'
                              : 'bg-gray-300 text-gray-600'
                          }`}>
                            4
                          </div>
                          <Video className={`h-4 w-4 ${
                            activeGenerationStep === 'video' ? 'text-purple-600' : 'text-gray-600'
                          }`} />
                          <h3 className="text-sm font-semibold text-gray-900">Video Generation</h3>
                        </div>
                        {activeGenerationStep === 'video' && (
                          <div className="flex items-center space-x-2 text-gray-600">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <p className="text-xs">Processing video...</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}


                  {generationResult && generationResult.status === 'completed' && (
                    <div className="p-4 space-y-4">
                      <div className="text-center text-green-600 font-medium text-sm mb-4">
                        ✓ Video creation completed!
                      </div>
                      
                      <div className="border border-green-200 rounded-lg bg-green-50">
                        <div 
                          className="flex items-center justify-between p-3 cursor-pointer hover:bg-green-100 transition-colors"
                          onClick={() => toggleSection('adScript')}
                        >
                          <div className="flex items-center">
                            <FileText className="h-4 w-4 text-green-600 mr-2" />
                            <h3 className="text-sm font-semibold text-gray-900">Ad Script</h3>
                          </div>
                          {collapsedSections.adScript ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronUp className="h-4 w-4 text-gray-500" />
                          )}
                        </div>
                        {!collapsedSections.adScript && (
                          <div className="px-3 pb-3">
                            <div className="bg-white rounded p-3 max-h-48 overflow-y-auto">
                              {generationResult.adScript.map((script, index) => (
                                <div key={index} className="mb-3 last:mb-0">
                                  <div className="text-xs text-gray-500 mb-1">Script {index + 1}:</div>
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{script}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Scene Description */}
                      <div className="border border-green-200 rounded-lg bg-green-50">
                        <div 
                          className="flex items-center justify-between p-3 cursor-pointer hover:bg-green-100 transition-colors"
                          onClick={() => toggleSection('sceneDescription')}
                        >
                          <div className="flex items-center">
                            <FileText className="h-4 w-4 text-green-600 mr-2" />
                            <h3 className="text-sm font-semibold text-gray-900">Scene Description</h3>
                          </div>
                          {collapsedSections.sceneDescription ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronUp className="h-4 w-4 text-gray-500" />
                          )}
                        </div>
                        {!collapsedSections.sceneDescription && (
                          <div className="px-3 pb-3">
                            <div className="bg-white rounded p-3 max-h-48 overflow-y-auto">
                              {generationResult.sceneDescription.map((scene, index) => (
                                <div key={index} className="mb-3 last:mb-0">
                                  <div className="text-xs text-gray-500 mb-1">Scene {index + 1}:</div>
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{scene}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Images */}
                      <div className="border border-green-200 rounded-lg bg-green-50">
                        <div 
                          className="flex items-center justify-between p-3 cursor-pointer hover:bg-green-100 transition-colors"
                          onClick={() => toggleSection('images')}
                        >
                          <div className="flex items-center">
                            <Image className="h-4 w-4 text-green-600 mr-2" />
                            <h3 className="text-sm font-semibold text-gray-900">Images ({generationResult.images.length})</h3>
                          </div>
                          {collapsedSections.images ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronUp className="h-4 w-4 text-gray-500" />
                          )}
                        </div>
                        {!collapsedSections.images && (
                          <div className="px-3 pb-3">
                            <div className="grid grid-cols-1 gap-2">
                              {generationResult.images.map((image, index) => (
                                <img
                                  key={index}
                                  src={image}
                                  alt={`Generated image ${index + 1}`}
                                  className="w-full h-auto object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => window.open(image, '_blank')}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Video */}
                      <div className="border border-green-200 rounded-lg bg-green-50">
                        <div 
                          className="flex items-center justify-between p-3 cursor-pointer hover:bg-green-100 transition-colors"
                          onClick={() => toggleSection('video')}
                        >
                          <div className="flex items-center">
                            <Video className="h-4 w-4 text-green-600 mr-2" />
                            <h3 className="text-sm font-semibold text-gray-900">Video</h3>
                          </div>
                          {collapsedSections.video ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronUp className="h-4 w-4 text-gray-500" />
                          )}
                        </div>
                        {!collapsedSections.video && (
                          <div className="px-3 pb-3">
                            {generationResult.video ? (
                              <video
                                src={generationResult.video}
                                controls
                                className="w-full rounded"
                              >
                                Your browser does not support the video tag.
                              </video>
                            ) : (
                              <div className="bg-white rounded p-4 text-center">
                                <Video className="h-8 w-8 text-gray-300 mx-auto mb-1" />
                                <p className="text-gray-500 text-xs">Video not available</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          
        </div>
      </div>
    </div>
  )
}
