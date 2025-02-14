import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  AIMessage,
  BaseMessage,
  BaseMessageLike,
  isAIMessageChunk,
  MessageContentText,
} from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import {
  Annotation,
  CompiledStateGraph,
  StateGraph
} from '@langchain/langgraph/web';
import { RunnableConfig } from '@langchain/core/runnables';

const StateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessageLike[]>({
    reducer: (x, y) => x.concat(y),
  }),
});

export function getMessageContentText(message: BaseMessage) {
  if (typeof message.content === 'string') {
    return message.content;
  } else {
    return message.content.filter(
      cnt => cnt.type === 'text' && cnt.text
    ).map(
      cnt => (cnt as MessageContentText).text
    ).join('');
  }
}

export class ChatAgent {
  private llm?: BaseChatModel;
  private graph?: CompiledStateGraph<any,any,any,any,any,any>;

  constructor() {
    const workflow = new StateGraph(StateAnnotation)
      .addNode('model', this.callModel)
      .addEdge('__start__', 'model')
      .addEdge('model', '__end__')
    ;
    this.graph = workflow.compile();
  }

  async callModel(
    state: typeof StateAnnotation.State,
    config?: RunnableConfig,
  ) {
    const { messages } = state;
    if (!this.llm) {
      const lastMessage = messages[messages.length - 1] as BaseMessage;
      try {
        this.llm = new ChatOpenAI({
          model: 'gpt-4o-mini',
          temperature: 0.0,
          openAIApiKey: getMessageContentText(lastMessage),
          streaming: true,
        });
      } catch (e) {
        return {
          messages: new AIMessage({
            content: 'Invalid OpenAI API key.'
          })
        }
      }
      return {
        messages: new AIMessage({
          content: 'Thanks! You can now start chatting.'
        })
      }
    }
    const responseMessage = await this.llm.invoke(messages, config);
    return {
      messages: [responseMessage]
    };
  }

  async *stream(messages: BaseMessageLike[]) {
    const stream = await this.graph!.stream(
      {
        messages: messages,
      },
      { streamMode: "messages" },
    );
    for await (const [message, _metadata] of stream) {
      if (isAIMessageChunk(message)) {
        yield message;
      } else {
        console.log(message, _metadata);
      }
    }
  }
}
