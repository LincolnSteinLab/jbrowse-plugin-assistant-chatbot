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
  baseUrl?: string
  temperature?: number
}

export class ChatModel extends ResponseParser {
  protected llm?: BaseChatModel

  async setupChatModel({
    provider,
    model,
    baseUrl,
    temperature,
  }: ChatModelConfig, getApiKey: ({}) => Promise<string | undefined>) {
    if (!provider) {
      throw new Error('Missing chat model provider')
    }
    temperature = (temperature ?? 0) / 100 // scale 0-100 to 0-1
    switch (provider) {
      case 'openai':
        this.llm = new ChatOpenAI({
          apiKey: await getApiKey({}),
          configuration: {
            baseURL: baseUrl ?? undefined,
          },
          model: model,
          streaming: true,
          temperature: temperature * 2,
        })
        break
      case 'anthropic':
        this.llm = new ChatAnthropic({
          anthropicApiUrl: baseUrl ?? undefined,
          apiKey: await getApiKey({}),
          model: model,
          streaming: true,
          temperature,
        })
        break
      case 'google':
        this.llm = new ChatGoogleGenerativeAI({
          apiKey: await getApiKey({}),
          baseUrl: baseUrl ?? undefined,
          model: model ?? 'gemini-2.5-flash-lite',
          streaming: true,
          temperature: temperature * 2,
        })
        break
      case 'ollama':
        this.llm = new ChatOllama({
          baseUrl: baseUrl ?? undefined,
          model: model,
          streaming: true,
          temperature: temperature * 2,
        })
        this.enableReasoningParsing()
        break
    }
  }
}

export async function getAvailableModels({
  provider,
  baseUrl,
}: ChatModelConfig, getApiKey: ({}) => Promise<string | undefined>): Promise<Record<string, ChatModelInfo>> {
  if (!provider) return {}
  switch (provider) {
    case 'openai':
      const openai_client = new OpenAIClient({
        apiKey: await getApiKey({}),
        baseURL: baseUrl,
        dangerouslyAllowBrowser: true,
      })
      const openai_model_pages = await openai_client.models.list()
      const openai_models = await Array.fromAsync(openai_model_pages)
      return Object.fromEntries(
        openai_models
          .filter(model => /^((chat)?gpt|o[0-9]+)/.exec(model.id))
          .map(model => [
            model.id,
            {
              id: model.id,
              description: `Created ${new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long' }).format(new Date(model.created * 1000))}`,
            },
          ]),
      )
    case 'anthropic':
      const anthropic_client = new Anthropic({
        apiKey: await getApiKey({}),
        baseURL: baseUrl,
        dangerouslyAllowBrowser: true,
      })
      const anthropic_model_pages = await anthropic_client.models.list()
      const anthropic_models = await Array.fromAsync(anthropic_model_pages)
      return Object.fromEntries(
        anthropic_models.map(model => [
          model.id,
          {
            id: model.id,
            description: `Created ${model.created_at}`,
          },
        ]),
      )
    case 'google':
      const google_client = new GoogleGenAI({ apiKey: await getApiKey({}), })
      const google_model_pages = await google_client.models.list()
      const google_models = await Array.fromAsync(google_model_pages)
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
      return Object.fromEntries(
        ollama_models.map(model => [
          model.name,
          {
            id: model.name,
            description: `Modified ${new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(model.modified_at))}`,
          },
        ]),
      )
  }
}
