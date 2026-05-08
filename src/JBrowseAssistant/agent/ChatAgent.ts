import {
  AIMessageChunk,
  BaseMessage,
  BaseMessageChunk,
} from '@langchain/core/messages'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { Command, MemorySaver } from '@langchain/langgraph'
import {
  computeSummarizationDefaults,
  createDeepAgent,
  createSummarizationMiddleware,
  StateBackend,
} from 'deepagents'

import ChatLLMCallbackHandler from './ChatLLMCallbackHandler'
import { ChatModel, ChatModelConfig } from './ChatModel'
import {
  builtInDeepAgentSkillPaths,
  builtInSubAgents,
  getBuiltInDeepAgentSkillFiles,
} from './deepAgentSkills'

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
    const backend = new StateBackend()
    const summarizationDefaults = computeSummarizationDefaults(this.llm!)
    const graph = createDeepAgent({
      model: this.llm!,
      tools: tools,
      systemPrompt,
      backend,
      checkpointer,
      skills: builtInDeepAgentSkillPaths,
      subagents: builtInSubAgents,
      middleware: [
        createSummarizationMiddleware({
          model: this.llm!,
          backend,
          trigger: summarizationDefaults.trigger,
          keep: summarizationDefaults.keep,
          truncateArgsSettings: summarizationDefaults.truncateArgsSettings,
        }),
      ],
    })
    const stream = await graph.stream(
      input instanceof Command
        ? input
        : {
            messages: input,
            files: getBuiltInDeepAgentSkillFiles(),
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
