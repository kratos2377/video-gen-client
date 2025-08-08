import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { idea, userId } = await request.json()

    if (!idea) {
      return new Response('Idea is required', { status: 400 })
    }

    // Create a readable stream for SSE
    const encoder = new TextEncoder()
    
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ 
            type: 'connection', 
            message: 'Connected to video generation stream' 
          })}\n\n`)
        )

        // Simulate streaming LLM response
        const simulateStreamingResponse = async () => {
          try {
            // Step 1: Analyzing idea
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: 'status', 
                message: 'Analyzing your video idea...',
                step: 'analyzing'
              })}\n\n`)
            )
            await new Promise(resolve => setTimeout(resolve, 1000))

            // Step 2: Generating script
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: 'status', 
                message: 'Generating script...',
                step: 'script'
              })}\n\n`)
            )
            await new Promise(resolve => setTimeout(resolve, 500))

            // Stream script content in chunks
            const scriptContent = `Here's a compelling script for your "${idea}" video:

Scene 1: Hook (0-3 seconds)
- Open with a bold statement or question that grabs attention
- Use dynamic visuals that relate to your core message

Scene 2: Problem/Pain Point (3-8 seconds)
- Highlight the challenge your audience faces
- Create emotional connection with relatable scenarios

Scene 3: Solution (8-15 seconds)
- Present your product/service as the solution
- Show clear benefits and value proposition

Scene 4: Social Proof (15-20 seconds)
- Include testimonials or success metrics
- Build credibility and trust

Scene 5: Call to Action (20-25 seconds)
- Clear, compelling CTA
- Create urgency or incentive to act now

This script is optimized for ${idea} and designed to maximize engagement and conversions.`

            const words = scriptContent.split(' ')
            for (let i = 0; i < words.length; i += 3) {
              const chunk = words.slice(i, i + 3).join(' ')
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ 
                  type: 'script_chunk', 
                  content: chunk + ' ',
                  isComplete: i + 3 >= words.length
                })}\n\n`)
              )
              await new Promise(resolve => setTimeout(resolve, 50))
            }

            // Step 3: Generating images
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: 'status', 
                message: 'Generating images...',
                step: 'images'
              })}\n\n`)
            )
            await new Promise(resolve => setTimeout(resolve, 1000))

            // Send generated images
            const images = [
              'https://via.placeholder.com/400x300/3B82F6/FFFFFF?text=Scene+1',
              'https://via.placeholder.com/400x300/10B981/FFFFFF?text=Scene+2',
              'https://via.placeholder.com/400x300/F59E0B/FFFFFF?text=Scene+3',
              'https://via.placeholder.com/400x300/EF4444/FFFFFF?text=Scene+4'
            ]

            for (let i = 0; i < images.length; i++) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ 
                  type: 'image', 
                  url: images[i],
                  index: i
                })}\n\n`)
              )
              await new Promise(resolve => setTimeout(resolve, 500))
            }

            // Step 4: Processing video
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: 'status', 
                message: 'Processing video...',
                step: 'video'
              })}\n\n`)
            )
            await new Promise(resolve => setTimeout(resolve, 2000))

            // Final completion
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: 'complete', 
                message: 'Video generation completed!',
                video: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4'
              })}\n\n`)
            )

            controller.close()
          } catch (error) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: 'error', 
                message: 'An error occurred during generation'
              })}\n\n`)
            )
            controller.close()
          }
        }

        simulateStreamingResponse()
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  } catch (error) {
    console.error('Streaming error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
