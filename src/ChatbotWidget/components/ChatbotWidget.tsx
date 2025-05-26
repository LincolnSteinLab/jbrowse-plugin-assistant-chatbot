import '../../styles/globals.css'

import {
  AssistantRuntimeProvider,
  ChatModelAdapter,
  ChatModelRunOptions,
  ThreadAssistantContentPart,
  ThreadMessage,
  useLocalRuntime,
} from '@assistant-ui/react'
import { defaultThemes } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import {
  AIMessage,
  BaseMessage,
  BaseMessageFields,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { observer } from 'mobx-react'
import React from 'react'

import { ChatAgent, getMessageContentText } from '../../chat/ChatAgent'
import stateModel from '../stateModel'
import { Thread } from '@/components/assistant-ui/thread'
import { ThreadList } from '@/components/assistant-ui/thread-list'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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

const ChatbotWidget = observer(function ({
  model,
}: {
  model: typeof stateModel
}) {
  const { allThemes, themeName = 'default' } = getSession(model)
  const themeOptions = allThemes?.()?.[themeName] ?? defaultThemes.default ?? {}
  themeOptions.cssVariables = true
  const theme = createTheme(themeOptions)
  const adapter = new LocalLangchainAdapter()
  const runtime = useLocalRuntime(adapter)
  return (
    <ThemeProvider theme={theme}>
      <AssistantRuntimeProvider runtime={runtime}>
        <Tabs
          defaultValue="chat"
          className="absolute gap-0 top-[48px] bottom-0 w-full max-w-full overflow-hidden"
        >
          <div className="flex items-center p-2">
            <TabsList>
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="threads">Threads</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
          </div>
          <Separator />
          <div className='relative flex-1'>
              <TabsContent value="chat" className='absolute inset-0'>
                <Thread />
              </TabsContent>
              <TabsContent value="threads" className="absolute inset-0 p-2 overflow-y-scroll">
                <ThreadList />
              </TabsContent>
              <TabsContent value="settings" className="absolute inset-0 p-2 overflow-y-scroll">
                Hello World
              </TabsContent>
          </div>

        </Tabs>
      </AssistantRuntimeProvider>
    </ThemeProvider>
  )
})

export default ChatbotWidget
