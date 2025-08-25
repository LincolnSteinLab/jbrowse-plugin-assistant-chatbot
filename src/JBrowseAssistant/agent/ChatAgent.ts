import { ChatAnthropic } from '@langchain/anthropic'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
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
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { Annotation, END, START, StateGraph } from '@langchain/langgraph/web'
import { ChatOllama } from '@langchain/ollama'
import { ChatOpenAI } from '@langchain/openai'

const StateAnnotation = Annotation.Root({
  systemPrompt: Annotation<string>,
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
})

export class ChatAgent {
  private llm?: BaseChatModel
  private llm_with_tools?: Runnable
  private graph?: ReturnType<typeof this.createWorkflow>
  private tool_node?: ToolNode

  constructor() {
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
      provider,
      model,
      apiKey,
      baseUrl,
    }: {
      tools?: DynamicStructuredTool[]
      systemPrompt?: string
      provider?: string
      model?: string
      apiKey?: string
      baseUrl?: string
    },
  ) {
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
        break
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
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
        streamMode: 'messages',
      },
    )
    for await (const [message, _metadata] of stream) {
      if (isAIMessageChunk(message as BaseMessageChunk)) {
        yield message as AIMessageChunk
      } else {
        console.log(message, _metadata)
      }
    }
  }
}
