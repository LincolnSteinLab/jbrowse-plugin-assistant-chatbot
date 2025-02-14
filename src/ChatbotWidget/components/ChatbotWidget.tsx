import {
  AssistantRuntimeProvider,
  ChatModelAdapter,
  ChatModelRunOptions,
  Thread,
  ThreadAssistantContentPart,
  ThreadMessage,
  useLocalRuntime,
} from '@assistant-ui/react'
import {
  AIMessage,
  BaseMessage,
  BaseMessageFields,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages'
import React from 'react'
import { createGlobalStyle } from 'styled-components'
import { ChatAgent, getMessageContentText } from '../../chat/ChatAgent'

import auiStyles from '@assistant-ui/react/styles/index.css'
import customStyles from './ChatbotWidget.css'

const AssistantUIStyle = createGlobalStyle`${auiStyles as string}`
const CustomStyle = createGlobalStyle`${customStyles as string}`

const chatAgent = new ChatAgent()

class LocalLangchainAdapter implements ChatModelAdapter {
  async *run({ messages }: ChatModelRunOptions) {
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
    const stream = chatAgent.stream(lc_messages)
    let text = ''
    for await (const part of stream) {
      text += getMessageContentText(part)
      yield {
        content: [{ type: 'text', text }] as ThreadAssistantContentPart[],
      }
    }
    return
  }
}

export default function ReactComponent() {
  const adapter = new LocalLangchainAdapter()
  const runtime = useLocalRuntime(adapter)
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AssistantUIStyle />
      <CustomStyle />
      <div className="chat-widget">
        <Thread
          welcome={{
            message: 'Enter your OpenAI API key to start chatting.',
          }}
        />
      </div>
    </AssistantRuntimeProvider>
  )
}
