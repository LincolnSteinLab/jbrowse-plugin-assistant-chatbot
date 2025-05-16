import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  BaseMessageChunk,
  BaseMessageLike,
  isAIMessageChunk,
  MessageContentText,
} from '@langchain/core/messages'
import { RunnableConfig } from '@langchain/core/runnables'
import { Annotation, StateGraph } from '@langchain/langgraph/web'
import { ChatOpenAI } from '@langchain/openai'

const StateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessageLike[]>({
    reducer: (x, y) => x.concat(y),
  }),
})

export function getMessageContentText(message: BaseMessage) {
  if (typeof message.content === 'string') {
    return message.content
  } else {
    return message.content
      .filter(cnt => cnt.type === 'text' && cnt.text)
      .map(cnt => (cnt as MessageContentText).text)
      .join('')
  }
}

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
    const { messages } = state
    if (!this.llm) {
      const lastMessage = messages[messages.length - 1] as BaseMessage
      try {
        this.llm = new ChatOpenAI({
          model: 'gpt-4o-mini',
          temperature: 0.0,
          openAIApiKey: getMessageContentText(lastMessage),
          streaming: true,
        })
      } catch {
        return {
          messages: new AIMessage({
            content: 'Invalid OpenAI API key.',
          }),
        }
      }
      return {
        messages: new AIMessage({
          content: 'Thanks! You can now start chatting.',
        }),
      }
    }
    const responseMessage = await this.llm.invoke(messages, config)
    return {
      messages: [responseMessage],
    }
  }

  async *stream(messages: BaseMessageLike[]) {
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
