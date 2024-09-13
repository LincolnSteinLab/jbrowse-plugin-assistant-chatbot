'use client'

import { useContext } from 'react'
import { CardContent } from '@mui/material'

import { MessagesContext } from '@/context/messages'
import ChatMessage from './ChatMessage'

export default function ChatMessages() {
  const { messages } = useContext(MessagesContext)
  return (
    <CardContent>
      <ChatMessage messages={messages} />
    </CardContent>
  )
}
