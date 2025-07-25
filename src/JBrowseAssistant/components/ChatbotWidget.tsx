// @ts-expect-error : Handled by rollup-plugin-import-css
import styles from '../../styles/globals.css'

import { AssistantRuntimeProvider, useLocalRuntime } from '@assistant-ui/react'
import { defaultThemes } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { observer } from 'mobx-react'
import React, { useEffect } from 'react'

import { Thread } from '@/components/assistant-ui/thread'
import { ThreadList } from '@/components/assistant-ui/thread-list'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { LocalLangchainAdapter } from '../LocalLangchainAdapter'
import { JBrowseConfigTool } from '../tools/JBrowseConfig'
import { JBrowseDocumentationTool } from '../tools/JBrowseDocumentation'

import { SettingsForm } from './SettingsForm'
import { IChatWidgetModel } from './model/ChatbotWidgetModel'

// Inject global styles
if (
  typeof document !== 'undefined' &&
  typeof document.getElementById === 'function' &&
  !document.getElementById('chatbot-css')
) {
  const styleElement = document.createElement('style')
  styleElement.id = 'chatbot-css'
  styleElement.textContent = styles
  document.head.appendChild(styleElement)
}

export const ChatbotWidget = observer(function ({
  model,
}: {
  model: IChatWidgetModel
}) {
  const { allThemes, jbrowse, themeName = 'default' } = getSession(model)
  // Synchronize chat UI with the JBrowse theme using CSS variables
  const themeOptions = allThemes?.()?.[themeName] ?? defaultThemes.default ?? {}
  themeOptions.cssVariables = true
  const theme = createTheme(themeOptions)
  // Setup assistant-ui runtime
  const adapter = new LocalLangchainAdapter()
  const runtime = useLocalRuntime(adapter)
  // Register chat settings as a context provider for the runtime
  useEffect(() => {
    return runtime.registerModelContextProvider({
      getModelContext: () => ({
        system: model.settingsForm.settings?.systemPrompt,
        tools: {
          jbrowseConfig: new JBrowseConfigTool(jbrowse),
          jbrowseDocumentation: new JBrowseDocumentationTool(),
        },
        config: {
          apiKey: model.settingsForm.settings?.openAIApiKey,
        },
      }),
    })
  })
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
