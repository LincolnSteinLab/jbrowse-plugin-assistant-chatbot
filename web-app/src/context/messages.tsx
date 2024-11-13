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
  removeMessage: (id: string) => void
}>({
  messages: [],
  addMessage: () => {},
  removeMessage: () => {},
})

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState(defaultValue)

  const addMessage = (message: IChatMessage) => {
    setMessages(prev => [...prev, message])
  }

  const removeMessage = (id: string) => {
    setMessages(prev => prev.filter(message => message.id !== id))
  }

  return (
    <MessagesContext.Provider value={{ messages, addMessage, removeMessage }}>
      {children}
    </MessagesContext.Provider>
  )
}
