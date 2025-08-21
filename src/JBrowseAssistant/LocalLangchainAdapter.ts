import {
  ChatModelAdapter,
  ChatModelRunOptions,
  ChatModelRunResult,
  ThreadMessage,
} from '@assistant-ui/react'
import {
  AIMessage,
  BaseMessage,
  BaseMessageFields,
  HumanMessage,
  MessageContentText,
  SystemMessage,
} from '@langchain/core/messages'

import { ChatAgent } from './agent/ChatAgent'
import { JBTool } from './tools/base'

function getLangchainTools(tools: Record<string, JBTool>) {
  return Object.values(tools).map(tool => tool.execute({}))
}

function getMessageContentText(message: BaseMessage) {
  if (typeof message.content === 'string') {
    return message.content
  } else {
    return message.content
      .filter(cnt => cnt.type === 'text' && cnt.text)
      .map(cnt => (cnt as MessageContentText).text)
      .join('')
  }
}

/**
 * LocalLangchainAdapter bridges Assistant UI with LangChain.js
 */
export class LocalLangchainAdapter implements ChatModelAdapter {
  chatAgent: ChatAgent

  constructor() {
    this.chatAgent = new ChatAgent()
  }

  async *run({ messages, context }: ChatModelRunOptions) {
    const lc_messages: BaseMessage[] = messages.map((tm: ThreadMessage) => {
      const fields: BaseMessageFields = {
        content: tm.content.map(part => {
          switch (part.type) {
            case 'text':
              return { type: 'text', text: part.text }
            default:
              throw new Error(`Unknown content part type: ${part.type}`)
          }
        }),
        id: tm.id,
      }
      switch (tm.role) {
        case 'system':
          return new SystemMessage(fields)
        case 'assistant':
          return new AIMessage(fields)
        case 'user':
          return new HumanMessage(fields)
      }
    })
    const providerModel = context.config?.modelName?.split('/', 2)
    const stream = this.chatAgent.stream(lc_messages, {
      tools: getLangchainTools((context.tools as Record<string, JBTool>) || {}),
      systemPrompt: context.system,
      provider: providerModel?.[0],
      model: providerModel?.[1],
      apiKey: context.config?.apiKey,
      baseUrl: context.config?.baseUrl,
    })
    let text = ''
    for await (const part of stream) {
      text += getMessageContentText(part)
      yield {
        content: [{ type: 'text', text }],
      } as ChatModelRunResult
    }
    return
  }
}
