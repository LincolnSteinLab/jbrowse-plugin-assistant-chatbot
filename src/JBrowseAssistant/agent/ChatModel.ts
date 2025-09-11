import { ChatAnthropic } from '@langchain/anthropic'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { ChatOllama } from '@langchain/ollama'
import { ChatOpenAI } from '@langchain/openai'

import { ResponseParser } from './ResponseParser'

export interface ChatModelConfig {
  provider?: string
  model?: string
  apiKey?: string
  baseUrl?: string
}

export class ChatModel extends ResponseParser {
  protected llm?: BaseChatModel

  setupChatModel = ({ provider, model, apiKey, baseUrl }: ChatModelConfig) => {
    switch (provider) {
      case 'openai':
        this.llm = new ChatOpenAI({
          apiKey: apiKey,
          configuration: {
            baseURL: baseUrl ?? undefined,
          },
          model: model,
          streaming: true,
          temperature: 0.0,
        })
        break
      case 'anthropic':
        this.llm = new ChatAnthropic({
          anthropicApiUrl: baseUrl ?? undefined,
          apiKey: apiKey,
          model: model,
          streaming: true,
          temperature: 0.0,
        })
        break
      case 'google':
        this.llm = new ChatGoogleGenerativeAI({
          apiKey: apiKey,
          baseUrl: baseUrl ?? undefined,
          model: model ?? 'gemini-2.5-flash-lite',
          streaming: true,
          temperature: 0.0,
        })
        break
      case 'ollama':
        this.llm = new ChatOllama({
          baseUrl: baseUrl ?? undefined,
          model: model,
          streaming: true,
          temperature: 0.0,
        })
        this.enableReasoningParsing()
        break
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
  }
}
