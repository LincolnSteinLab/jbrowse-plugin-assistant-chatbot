import { ModelContext } from '@assistant-ui/react'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import {
  AIMessage,
  AIMessageChunk,
  BaseMessageChunk,
  BaseMessageLike,
  isAIMessageChunk,
} from '@langchain/core/messages'
import { RunnableConfig } from '@langchain/core/runnables'
import { Annotation, StateGraph } from '@langchain/langgraph/web'
import { ChatOpenAI } from '@langchain/openai'

const StateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessageLike[]>({
    reducer: (x, y) => x.concat(y),
  }),
})

export class ChatAgent {
  private llm?: BaseChatModel
  private graph?: ReturnType<typeof this.createWorkflow>

  constructor() {
    this.graph = this.createWorkflow()
  }

  createWorkflow() {
    const workflow = new StateGraph(StateAnnotation)
      .addNode('model', this.callModel)
      .addEdge('__start__', 'model')
      .addEdge('model', '__end__')
    return workflow.compile()
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
    const { messages } = state
    const responseMessage = await this.llm.invoke(messages, config)
    return {
      messages: [responseMessage],
    }
  }

  async *stream(messages: BaseMessageLike[], modelContext: ModelContext) {
    this.llm = new ChatOpenAI({
      apiKey: modelContext.config?.apiKey,
      model: 'gpt-4o-mini',
      streaming: true,
      temperature: 0.0,
    })
    const stream = await this.graph!.stream(
      {
        messages: messages,
      },
      { streamMode: 'messages' },
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
