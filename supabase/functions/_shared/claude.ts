/**
 * Shared Claude API client for Edge Functions
 * Uses Anthropic Messages API directly (no SDK needed in Deno)
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-20250514'
const MAX_RETRIES = 3

interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ClaudeResponse {
  id: string
  content: Array<{ type: string; text: string }>
  model: string
  usage: { input_tokens: number; output_tokens: number }
  stop_reason: string
}

export async function callClaude(
  systemPrompt: string,
  messages: ClaudeMessage[],
  options: {
    maxTokens?: number
    temperature?: number
    stream?: boolean
  } = {}
): Promise<ClaudeResponse> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const { maxTokens = 4096, temperature = 0.3 } = options

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: maxTokens,
          temperature,
          system: systemPrompt,
          messages,
        }),
      })

      if (res.status === 429 || res.status >= 500) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '0') || (2 ** attempt * 2)
        console.warn(`Claude API ${res.status}, retrying in ${retryAfter}s (attempt ${attempt + 1})`)
        await new Promise(r => setTimeout(r, retryAfter * 1000))
        continue
      }

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`Claude API error ${res.status}: ${body}`)
      }

      return await res.json() as ClaudeResponse
    } catch (err) {
      if (attempt === MAX_RETRIES - 1) throw err
      await new Promise(r => setTimeout(r, 2 ** attempt * 1000))
    }
  }

  throw new Error('Claude API: max retries exceeded')
}

/**
 * Stream Claude response - returns a ReadableStream for SSE
 */
export function streamClaude(
  systemPrompt: string,
  messages: ClaudeMessage[],
  options: { maxTokens?: number; temperature?: number } = {}
): ReadableStream {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const { maxTokens = 4096, temperature = 0.3 } = options

  return new ReadableStream({
    async start(controller) {
      try {
        const res = await fetch(ANTHROPIC_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: maxTokens,
            temperature,
            system: systemPrompt,
            messages,
            stream: true,
          }),
        })

        if (!res.ok) {
          const body = await res.text()
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'error', error: body })}\n\n`))
          controller.close()
          return
        }

        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue
              try {
                const event = JSON.parse(data)
                if (event.type === 'content_block_delta' && event.delta?.text) {
                  controller.enqueue(
                    new TextEncoder().encode(`data: ${JSON.stringify({ type: 'text', text: event.delta.text })}\n\n`)
                  )
                }
                if (event.type === 'message_stop') {
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
                }
              } catch { /* skip unparseable */ }
            }
          }
        }

        controller.close()
      } catch (err) {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify({ type: 'error', error: (err as Error).message })}\n\n`)
        )
        controller.close()
      }
    },
  })
}

export function extractText(response: ClaudeResponse): string {
  return response.content
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('')
}
