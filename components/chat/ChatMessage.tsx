'use client'

import { User, Bot, Loader2 } from 'lucide-react'

interface ChatMessageProps {
  message: {
    id: string
    type: 'user' | 'assistant'
    content: string
    timestamp: Date
    isStreaming?: boolean
  }
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.type === 'user'
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex max-w-xs lg:max-w-md ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end space-x-2`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-blue-600 ml-2' : 'bg-gray-600 mr-2'
        }`}>
          {isUser ? (
            <User className="h-4 w-4 text-white" />
          ) : (
            <Bot className="h-4 w-4 text-white" />
          )}
        </div>
        
        {/* Message bubble */}
        <div className={`px-4 py-2 rounded-lg ${
          isUser 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-100 text-gray-900'
        }`}>
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          {message.isStreaming && (
            <div className="flex items-center mt-2">
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              <span className="text-xs opacity-70">Generating...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
