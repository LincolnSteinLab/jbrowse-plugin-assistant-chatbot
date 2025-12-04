import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  BaseMessageChunk,
  isAIMessageChunk,
  SystemMessage,
} from '@langchain/core/messages'
import { Runnable, RunnableConfig } from '@langchain/core/runnables'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { Annotation, END, START, StateGraph } from '@langchain/langgraph/web'

import { InterruptPart } from '../tools/base'

import ChatLLMCallbackHandler from './ChatLLMCallbackHandler'
import { ChatModel, ChatModelConfig } from './ChatModel'

const StateAnnotation = Annotation.Root({
  systemPrompt: Annotation<string>,
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
})

export class ChatAgent extends ChatModel {
  private llm_with_tools?: Runnable
  private graph?: ReturnType<typeof this.createWorkflow>
  private tool_node?: ToolNode

  constructor() {
    super()
    this.graph = this.createWorkflow()
  }

  createWorkflow() {
    this.tool_node = new ToolNode([])
    const workflow = new StateGraph(StateAnnotation)
      .addNode('agent', this.callModel)
      .addNode('tools', this.tool_node)
      .addEdge(START, 'agent')
      .addConditionalEdges('agent', this.shouldContinue, ['tools', END])
      .addEdge('tools', 'agent')
    return workflow.compile()
  }

  shouldContinue = ({ messages }: typeof StateAnnotation.State) => {
    const lastMessage = messages[messages.length - 1]
    if (
      'tool_calls' in lastMessage &&
      Array.isArray(lastMessage.tool_calls) &&
      lastMessage.tool_calls.length
    ) {
      return 'tools'
    }
    return END
  }

  callModel = async (
    state: typeof StateAnnotation.State,
    config?: RunnableConfig,
  ) => {
    if (!this.llm) {
      return {
        messages: new AIMessage({
          content: 'Error: LLM not initialized.',
        }),
      }
    }
    const { systemPrompt, messages } = state
    const model = this.llm_with_tools ?? this.llm
    const responseMessage = await model.invoke(
      [new SystemMessage(systemPrompt), ...messages],
      config,
    )
    return {
      messages: [responseMessage],
    }
  }

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
    if (tools && this.llm?.bindTools && this.tool_node) {
      this.llm_with_tools = this.llm.bindTools(tools)
      this.tool_node.tools = tools ?? []
    }
    const stream = await this.graph!.stream(
      {
        systemPrompt: systemPrompt,
        messages: messages,
      },
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
        if (isAIMessageChunk(message as BaseMessageChunk)) {
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
