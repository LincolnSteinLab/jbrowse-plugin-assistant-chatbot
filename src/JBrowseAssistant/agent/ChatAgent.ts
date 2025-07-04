import { PretrainedModelOptions } from '@huggingface/transformers'
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/huggingface_transformers'
import { Embeddings } from '@langchain/core/embeddings'
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
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { Annotation, END, START, StateGraph } from '@langchain/langgraph/web'
import { ChatOpenAI } from '@langchain/openai'

export interface EmbeddingsSpec {
  embeddings: Embeddings
  config_id: string
}

interface ConfigurableSpec {
  embeddings_spec: EmbeddingsSpec
}

export type RunConfig = RunnableConfig<ConfigurableSpec>

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
      .addEdge('agent', END)
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
    messages.unshift(new SystemMessage(systemPrompt))
    const model = this.llm_with_tools ?? this.llm
    const responseMessage = await model.invoke(messages, config)
    return {
      messages: [responseMessage],
    }
  }

  async *stream(
    messages: BaseMessage[],
    {
      tools,
      systemPrompt,
      apiKey,
    }: {
      tools: DynamicStructuredTool[] | undefined
      systemPrompt: string | undefined
      apiKey: string | undefined
    },
  ) {
    this.llm = new ChatOpenAI({
      apiKey: apiKey,
      model: 'gpt-4o-mini',
      streaming: true,
      temperature: 0.0,
    })
    if (tools && this.llm?.bindTools && this.tool_node) {
      this.llm_with_tools = this.llm.bindTools(tools)
      this.tool_node.tools = tools ?? []
    }
    const config: RunConfig = {
      configurable: {
        embeddings_spec: {
          embeddings: new HuggingFaceTransformersEmbeddings({
            model: 'onnx-community/Qwen3-Embedding-0.6B-ONNX',
            pretrainedOptions: { device: 'webgpu' } as PretrainedModelOptions,
          }),
          config_id: 'onnx-community/Qwen3-Embedding-0.6B-ONNX',
        },
      },
    }
    const stream = await this.graph!.stream(
      {
        systemPrompt: systemPrompt,
        messages: messages,
      },
      {
        ...config,
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
