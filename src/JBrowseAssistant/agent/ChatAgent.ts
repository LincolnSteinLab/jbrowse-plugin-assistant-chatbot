import {
  AIMessageChunk,
  BaseMessage,
  BaseMessageChunk,
} from '@langchain/core/messages'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { createAgent } from 'langchain'

import { InterruptPart } from '../tools/base'

import ChatLLMCallbackHandler from './ChatLLMCallbackHandler'
import { ChatModel, ChatModelConfig } from './ChatModel'

export class ChatAgent extends ChatModel {
  async *stream(
    messages: BaseMessage[],
    {
      tools,
      systemPrompt,
      abortSignal,
      chatModelConfig,
    }: {
      tools?: DynamicStructuredTool[]
      systemPrompt?: string
      abortSignal?: AbortSignal
      chatModelConfig: ChatModelConfig
    },
  ) {
    this.resetParser()
    await this.setupChatModel(chatModelConfig)
    const graph = createAgent({
      model: this.llm!,
      tools: tools ?? [],
      systemPrompt,
    })
    const stream = await graph.stream(
      { messages },
      {
        callbacks: [new ChatLLMCallbackHandler()],
        configurable: { thread_id: '1' },
        signal: abortSignal,
        streamMode: ['messages', 'updates', 'custom'],
      },
    )
    for await (const [streamMode, part] of stream) {
      if (streamMode === 'messages') {
        let [message] = part
        if (AIMessageChunk.isInstance(message as BaseMessageChunk)) {
          message = this.parseResponse(message as AIMessageChunk)
        }
        yield message as BaseMessageChunk
      } else if (streamMode === 'updates') {
        yield part
      } else if (streamMode === 'custom') {
        yield part as InterruptPart
      }
    }
    const finalChunk = this.finalParsedChunk()
    if (finalChunk) {
      yield finalChunk
    }
  }
}
