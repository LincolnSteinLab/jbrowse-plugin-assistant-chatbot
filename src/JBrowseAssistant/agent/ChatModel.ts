import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import { ChatAnthropic } from '@langchain/anthropic'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { ChatOllama } from '@langchain/ollama'
import { ChatOpenAI, OpenAIClient } from '@langchain/openai'
import { Ollama } from 'ollama/dist/browser'

import { ResponseParser } from './ResponseParser'

export const ChatModelProviders = [
  'openai',
  'anthropic',
  'google',
  'ollama',
] as const
export type ChatModelProvider = (typeof ChatModelProviders)[number]

export interface ChatModelInfo {
  id: string
  description?: string
}

export interface ChatModelConfig {
  provider?: ChatModelProvider
  model?: string
  apiKey?: string
  baseUrl?: string
}

export class ChatModel extends ResponseParser {
  protected llm?: BaseChatModel

  setupChatModel = ({ provider, model, apiKey, baseUrl }: ChatModelConfig) => {
    if (!provider) {
      throw new Error('Missing chat model provider')
    }
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
    }
  }
}

export async function getAvailableModels({
  provider,
  baseUrl,
  apiKey,
}: ChatModelConfig): Promise<Record<string, ChatModelInfo>> {
  if (!provider) return {}
  switch (provider) {
    case 'openai':
      const openai_client = new OpenAIClient({
        apiKey,
        baseURL: baseUrl,
        dangerouslyAllowBrowser: true,
      })
      const openai_model_pages = await openai_client.models.list()
      const openai_models = await Array.fromAsync(openai_model_pages)
      console.log(openai_models)
      return Object.fromEntries(
        openai_models.map(model => [model.id, { id: model.id }]),
      )
    case 'anthropic':
      const anthropic_client = new Anthropic({
        apiKey,
        baseURL: baseUrl,
      })
      const anthropic_model_pages = await anthropic_client.models.list()
      const anthropic_models = await Array.fromAsync(anthropic_model_pages)
      console.log(anthropic_models)
      return Object.fromEntries(
        anthropic_models.map(model => [model.id, { id: model.id }]),
      )
    case 'google':
      const google_client = new GoogleGenAI({ apiKey })
      const google_model_pages = await google_client.models.list()
      const google_models = await Array.fromAsync(google_model_pages)
      console.log(google_models)
      return Object.fromEntries(
        google_models
          .filter(
            model =>
              model.name && model.supportedActions?.includes('generateContent'),
          )
          .map(model => ({
            id: model.name!.replace(/^models\//, ''),
            description: model.description,
          }))
          .map(model => [model.id, model]),
      )
    case 'ollama':
      const ollama_client = new Ollama({ host: baseUrl })
      const ollama_models = (await ollama_client.list()).models
      console.log(ollama_models)
      return Object.fromEntries(
        ollama_models.map(model => [model.name, { id: model.name }]),
      )
  }
}
