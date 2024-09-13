import { createContext, useState } from 'react'
import { nanoid } from 'nanoid'
import { IChatMessage } from '@/util'

const defaultValue = [
  {
    id: nanoid(),
    isUserMessage: false,
    text: 'Welcome to the JBrowse configuration assistant. Type your question about your config file below.',
  },
] as IChatMessage[]

export const MessagesContext = createContext<{
  messages: IChatMessage[]
  addMessage: (message: IChatMessage) => void
}>({
  messages: [],
  addMessage: () => {},
})

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState(defaultValue)

  const addMessage = (message: IChatMessage) => {
    setMessages(prev => [...prev, message])
  }

  return (
    <MessagesContext.Provider value={{ messages, addMessage }}>
      {children}
    </MessagesContext.Provider>
  )
}
