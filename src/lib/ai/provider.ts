// ============================================================
// AI Provider Abstraction Layer
// ============================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  model?: string
  maxTokens?: number
  temperature?: number
}

export interface ChatResponse {
  content: string
  model: string
  tokensUsed: { input: number; output: number }
}

export interface AIProviderClient {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>
  embed(text: string): Promise<number[]>
}

// ============================================================
// OpenRouter Provider
// ============================================================

class OpenRouterProvider implements AIProviderClient {
  private apiKey: string
  private defaultModel = 'anthropic/claude-3.5-sonnet'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<ChatResponse> {
    const model = options?.model ?? this.defaultModel

    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? '',
          'X-Title': 'AWFood Ticket Management',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: options?.maxTokens ?? 1024,
          temperature: options?.temperature ?? 0.3,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(
        `OpenRouter API error: ${(error as { error?: { message?: string } }).error?.message ?? response.statusText}`
      )
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>
      model: string
      usage: { prompt_tokens: number; completion_tokens: number }
    }

    return {
      content: data.choices[0]?.message?.content ?? '',
      model: data.model,
      tokensUsed: {
        input: data.usage?.prompt_tokens ?? 0,
        output: data.usage?.completion_tokens ?? 0,
      },
    }
  }

  async embed(text: string): Promise<number[]> {
    return openaiEmbed(this.apiKey, text)
  }
}

// ============================================================
// Claude (Anthropic) Provider
// ============================================================

class ClaudeProvider implements AIProviderClient {
  private apiKey: string
  private defaultModel = 'claude-sonnet-4-20250514'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<ChatResponse> {
    const model = options?.model ?? this.defaultModel

    // Anthropic API requires system prompt to be separate
    const systemMessage = messages.find((m) => m.role === 'system')
    const chatMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }))

    const body: Record<string, unknown> = {
      model,
      messages: chatMessages,
      max_tokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.3,
    }

    if (systemMessage) {
      body.system = systemMessage.content
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(
        `Anthropic API error: ${(error as { error?: { message?: string } }).error?.message ?? response.statusText}`
      )
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>
      model: string
      usage: { input_tokens: number; output_tokens: number }
    }

    const textContent = data.content.find((c) => c.type === 'text')

    return {
      content: textContent?.text ?? '',
      model: data.model,
      tokensUsed: {
        input: data.usage?.input_tokens ?? 0,
        output: data.usage?.output_tokens ?? 0,
      },
    }
  }

  async embed(text: string): Promise<number[]> {
    // Anthropic does not provide an embedding API; use OpenAI for embeddings.
    // The caller should supply an OpenAI API key via the OPENAI_API_KEY env var.
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      throw new Error(
        'OPENAI_API_KEY environment variable is required for embeddings when using the Claude provider.'
      )
    }
    return openaiEmbed(openaiKey, text)
  }
}

// ============================================================
// OpenAI Provider
// ============================================================

class OpenAIProvider implements AIProviderClient {
  private apiKey: string
  private defaultModel = 'gpt-4o-mini'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<ChatResponse> {
    const model = options?.model ?? this.defaultModel

    const response = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: options?.maxTokens ?? 1024,
          temperature: options?.temperature ?? 0.3,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(
        `OpenAI API error: ${(error as { error?: { message?: string } }).error?.message ?? response.statusText}`
      )
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>
      model: string
      usage: { prompt_tokens: number; completion_tokens: number }
    }

    return {
      content: data.choices[0]?.message?.content ?? '',
      model: data.model,
      tokensUsed: {
        input: data.usage?.prompt_tokens ?? 0,
        output: data.usage?.completion_tokens ?? 0,
      },
    }
  }

  async embed(text: string): Promise<number[]> {
    return openaiEmbed(this.apiKey, text)
  }
}

// ============================================================
// Shared Embedding Function (OpenAI text-embedding-3-small)
// ============================================================

async function openaiEmbed(apiKey: string, text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(
      `OpenAI Embeddings API error: ${(error as { error?: { message?: string } }).error?.message ?? response.statusText}`
    )
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[] }>
  }

  const embedding = data.data[0]?.embedding
  if (!embedding) {
    throw new Error('No embedding returned from OpenAI API.')
  }

  return embedding
}

// ============================================================
// Factory
// ============================================================

/**
 * Creates an AI provider client for the specified provider type.
 */
export function createAIProvider(
  provider: 'openrouter' | 'claude' | 'openai',
  apiKey: string
): AIProviderClient {
  if (!apiKey) {
    throw new Error(`API key is required for the "${provider}" AI provider.`)
  }

  switch (provider) {
    case 'openrouter':
      return new OpenRouterProvider(apiKey)
    case 'claude':
      return new ClaudeProvider(apiKey)
    case 'openai':
      return new OpenAIProvider(apiKey)
    default:
      throw new Error(`Unsupported AI provider: ${provider as string}`)
  }
}
