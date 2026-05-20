import {
  AIMessageChunk,
  BaseMessage,
  BaseMessageChunk,
} from '@langchain/core/messages'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { Command, MemorySaver } from '@langchain/langgraph'
import { createDeepAgent, StateBackend } from 'deepagents'

import { getSkills, skillsPath } from '../skills'

import ChatLLMCallbackHandler from './ChatLLMCallbackHandler'
import { ChatModel, ChatModelConfig } from './ChatModel'
import { builtInSubAgents } from './subagents'

const checkpointer = new MemorySaver()

export class ChatAgent extends ChatModel {
  async *stream(
    input: BaseMessage[] | Command,
    {
      tools,
      systemPrompt,
      abortSignal,
      chatModelConfig,
      threadId,
    }: {
      tools?: DynamicStructuredTool[]
      systemPrompt?: string
      abortSignal?: AbortSignal
      chatModelConfig: ChatModelConfig
      threadId: string
    },
  ) {
    this.resetParser()
    await this.setupChatModel(chatModelConfig)
    const graph = createDeepAgent({
      model: this.llm!,
      tools: tools,
      systemPrompt,
      backend: new StateBackend(),
      checkpointer,
      skills: [skillsPath],
      subagents: builtInSubAgents,
    })
    const stream = await graph.stream(
      input instanceof Command
        ? input
        : {
            messages: input,
            files: getSkills(),
          },
      {
        callbacks: [new ChatLLMCallbackHandler()],
        configurable: { thread_id: threadId },
        signal: abortSignal,
        streamMode: ['messages', 'updates'],
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
      }
    }
    const finalChunk = this.finalParsedChunk()
    if (finalChunk) {
      yield finalChunk
    }
  }
}
