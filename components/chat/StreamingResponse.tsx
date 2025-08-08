'use client'

import { useState, useEffect } from 'react'
import { Loader2, FileText, Image, Video, CheckCircle, AlertCircle } from 'lucide-react'

interface StreamingResponseProps {
  isActive: boolean
  onComplete?: (result: GenerationResult) => void
}

interface GenerationResult {
  script: string
  images: string[]
  video?: string
  status: 'generating' | 'completed' | 'error'
}

interface StreamEvent {
  type: 'connection' | 'status' | 'script_chunk' | 'image' | 'complete' | 'error'
  message?: string
  content?: string
  url?: string
  index?: number
  step?: string
  video?: string
  isComplete?: boolean
}

export function StreamingResponse({ isActive, onComplete }: StreamingResponseProps) {
  const [currentStatus, setCurrentStatus] = useState<string>('')
  const [currentStep, setCurrentStep] = useState<string>('')
  const [script, setScript] = useState<string>('')
  const [images, setImages] = useState<string[]>([])
  const [video, setVideo] = useState<string>('')
  const [isCompleted, setIsCompleted] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (!isActive) {
      // Reset state when not active
      setCurrentStatus('')
      setCurrentStep('')
      setScript('')
      setImages([])
      setVideo('')
      setIsCompleted(false)
      setHasError(false)
      return
    }

    // This would be called from the parent component with the SSE data
    // For now, we'll just show the streaming UI
  }, [isActive])

  const getStepIcon = (step: string) => {
    switch (step) {
      case 'analyzing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      case 'script':
        return <FileText className="h-4 w-4 text-green-600" />
      case 'images':
        return <Image className="h-4 w-4 text-purple-600" />
      case 'video':
        return <Video className="h-4 w-4 text-red-600" />
      default:
        return <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
    }
  }

  if (!isActive) return null

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
      {/* Status */}
      {currentStatus && (
        <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
          {getStepIcon(currentStep)}
          <span className="text-sm font-medium text-gray-900">{currentStatus}</span>
        </div>
      )}

      {/* Script Section */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Generated Script</h3>
          {script && <CheckCircle className="h-4 w-4 text-green-600" />}
        </div>
        {script ? (
          <div className="bg-gray-50 rounded-md p-4">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{script}</p>
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
          {images.length > 0 && <CheckCircle className="h-4 w-4 text-green-600" />}
        </div>
        {images.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {images.map((image, index) => (
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
          {video && <CheckCircle className="h-4 w-4 text-green-600" />}
        </div>
        {video ? (
          <video
            src={video}
            controls
            className="w-full rounded-md"
          >
            Your browser does not support the video tag.
          </video>
        ) : (
          <div className="bg-gray-50 rounded-md p-8 text-center">
            <div className="flex flex-col items-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <p className="text-gray-500 text-sm">Processing video...</p>
            </div>
          </div>
        )}
      </div>

      {/* Error State */}
      {hasError && (
        <div className="flex items-center space-x-3 p-3 bg-red-50 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <span className="text-sm font-medium text-red-900">
            An error occurred during generation. Please try again.
          </span>
        </div>
      )}

      {/* Completion State */}
      {isCompleted && (
        <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-900">
            Video generation completed successfully!
          </span>
        </div>
      )}
    </div>
  )
}
