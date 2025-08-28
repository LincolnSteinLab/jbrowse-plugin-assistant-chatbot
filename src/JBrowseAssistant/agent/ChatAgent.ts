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

const THINK_START = '<think>'
const THINK_END = '</think>'

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
  private last_text = ''
  private is_reasoning_parsing_enabled = false
  private is_reasoning = false

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

  resetParser = () => {
    this.is_reasoning_parsing_enabled = false
    this.is_reasoning = false
    this.last_text = ''
  }

  enableReasoningParsing = () => {
    this.is_reasoning_parsing_enabled = true
    this.is_reasoning = false
  }

  parseResponse = (message: AIMessageChunk) => {
    this.last_text += message.text
    if (!this.is_reasoning_parsing_enabled) return message
    message.additional_kwargs = message.additional_kwargs ?? {}
    const buffer = THINK_END.length - 1
    if (this.is_reasoning) {
      // currently inside a <think> ... looking for THINK_END
      const endIdx = this.last_text.indexOf(THINK_END)
      if (endIdx === -1) {
        // no end yet: emit everything except the tail buffer as reasoning
        if (this.last_text.length > buffer) {
          message.additional_kwargs.reasoning_content = this.last_text.slice(
            0,
            -buffer,
          )
          message.content = ''
          this.last_text = this.last_text.slice(-buffer)
        } else {
          // not enough data to emit yet
          message.additional_kwargs.reasoning_content = ''
          message.content = ''
        }
      } else {
        // found end tag
        const reasoning = this.last_text.slice(0, endIdx)
        const after = this.last_text.slice(endIdx + THINK_END.length)
        message.additional_kwargs.reasoning_content = reasoning
        if (after.length > buffer) {
          message.content = after.slice(0, -buffer)
          this.last_text = after.slice(-buffer)
        } else {
          message.content = after
          this.last_text = ''
        }
        this.is_reasoning = false
      }
    } else {
      // currently outside reasoning, look for THINK_START
      const startIdx = this.last_text.indexOf(THINK_START)
      if (startIdx === -1) {
        // no start found: emit everything except the tail buffer
        if (this.last_text.length > buffer) {
          message.content = this.last_text.slice(0, -buffer)
          this.last_text = this.last_text.slice(-buffer)
        } else {
          // not enough data to emit yet
          message.content = ''
        }
      } else {
        // found a start tag
        const content = this.last_text.slice(0, startIdx)
        const endIdx = this.last_text.indexOf(
          THINK_END,
          startIdx + THINK_START.length,
        )
        if (endIdx === -1) {
          // reasoning starts here but doesn't end yet
          const reasoningTail = this.last_text.slice(
            startIdx + THINK_START.length,
          )
          if (reasoningTail.length > buffer) {
            message.additional_kwargs.reasoning_content = reasoningTail.slice(
              0,
              -buffer,
            )
            this.last_text = reasoningTail.slice(-buffer)
          } else {
            message.additional_kwargs.reasoning_content = reasoningTail
            this.last_text = ''
          }
          message.content = content
          this.is_reasoning = true
        } else {
          // complete <think>...</think> exists in buffer
          const reasoning = this.last_text.slice(
            startIdx + THINK_START.length,
            endIdx,
          )
          const after = this.last_text.slice(endIdx + THINK_END.length)
          if (after.length > buffer) {
            message.content = content + after.slice(0, -buffer)
            this.last_text = after.slice(-buffer)
          } else {
            message.content = content + after
            this.last_text = ''
          }
          message.additional_kwargs.reasoning_content = reasoning
          this.is_reasoning = false
        }
      }
    }
    return message
  }

  finalParsedChunk = () => {
    if (!this.is_reasoning_parsing_enabled || this.last_text.length === 0)
      return
    if (this.is_reasoning) {
      return new AIMessageChunk({
        additional_kwargs: { reasoning_content: this.last_text },
        content: '',
      })
    } else {
      return new AIMessageChunk({ content: this.last_text })
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
    this.resetParser()
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
        streamMode: ['messages', 'updates'],
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
      }
    }
    const finalChunk = this.finalParsedChunk()
    if (finalChunk) {
      yield finalChunk
    }
  }
}
