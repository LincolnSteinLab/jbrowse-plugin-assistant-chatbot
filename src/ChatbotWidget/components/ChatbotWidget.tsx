import '../../styles/globals.css'

import {
  AssistantRuntimeProvider,
  ChatModelAdapter,
  ChatModelRunOptions,
  ThreadAssistantContentPart,
  ThreadMessage,
  useLocalRuntime,
} from '@assistant-ui/react'
import { zodResolver } from '@hookform/resolvers/zod'
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
import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'

import { ChatAgent, getMessageContentText } from '../../chat/ChatAgent'
import {
  IChatWidgetModel,
  ISettingsFormModel,
  Settings,
  SettingsFormSchema,
} from '../stateModel'
import { Thread } from '@/components/assistant-ui/thread'
import { ThreadList } from '@/components/assistant-ui/thread-list'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

const chatAgent = new ChatAgent()

class LocalLangchainAdapter implements ChatModelAdapter {
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
    const stream = chatAgent.stream(lc_messages, context)
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

function withExceptionCapturing<S, T extends unknown[]>(
  fn: (...rest: T) => Promise<S>,
) {
  return (...args: T) => {
    fn(...args).catch(error => {
      console.error('Unexpected error', error)
    })
  }
}

const SettingsForm = observer(function ({
  model,
}: {
  model: ISettingsFormModel
}) {
  const form = useForm<Settings>({
    resolver: zodResolver(SettingsFormSchema),
    defaultValues: model.settings,
  })
  const onSubmit = withExceptionCapturing(
    form.handleSubmit((s: Settings) => model.set(s)),
  )
  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="grid gap-2">
        <FormField
          control={form.control}
          name="openAIApiKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>OpenAI API key</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormDescription>
                Used to generate responses from OpenAI directly from your
                browser.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="systemPrompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>System Prompt</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormDescription>
                Used to set the context for the chat.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Save</Button>
      </form>
    </Form>
  )
})

const ChatbotWidget = observer(function ({
  model,
}: {
  model: IChatWidgetModel
}) {
  const { allThemes, themeName = 'default' } = getSession(model)
  // Synchronize chat UI with the JBrowse theme using CSS variables
  const themeOptions = allThemes?.()?.[themeName] ?? defaultThemes.default ?? {}
  themeOptions.cssVariables = true
  const theme = createTheme(themeOptions)
  // Setup assistant-ui runtime
  const adapter = new LocalLangchainAdapter()
  const runtime = useLocalRuntime(adapter)
  // Register chat settings as a context provider for the runtime
  useEffect(() =>
    runtime.registerModelContextProvider({
      getModelContext: () => ({
        config: {
          apiKey: model.settingsForm.settings?.openAIApiKey,
        },
      }),
    }),
  )
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
          <div className="relative flex-1">
            <TabsContent value="chat" className="absolute inset-0">
              <Thread />
            </TabsContent>
            <TabsContent
              value="threads"
              className="absolute inset-0 p-2 overflow-y-scroll"
            >
              <ThreadList />
            </TabsContent>
            <TabsContent
              value="settings"
              className="absolute inset-0 p-2 overflow-y-scroll"
            >
              <SettingsForm model={model.settingsForm} />
            </TabsContent>
          </div>
        </Tabs>
      </AssistantRuntimeProvider>
    </ThemeProvider>
  )
})

export default ChatbotWidget
