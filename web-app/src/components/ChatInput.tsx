'use client'

import { useContext, useState } from 'react'
import { nanoid } from 'nanoid'
import { IconButton, InputAdornment, TextField } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'

import { IChatMessage } from '../util'
import { MessagesContext } from '@/context/messages'

const loadingMessage: IChatMessage = {
  id: 'loadingMessage',
  isUserMessage: false,
  text: '',
}

export default function ChatInput() {
  const [input, setInput] = useState<string>('')
  const [isDisabled, setIsDisabled] = useState(false)
  const { messages, addMessage, removeMessage } = useContext(MessagesContext)

  const sendMessage = async (userInput: string) => {
    const message: IChatMessage = {
      id: nanoid(),
      isUserMessage: true,
      text: userInput,
    }

    addMessage(message)

    addMessage(loadingMessage)

    const response = await fetch('http://127.0.0.1:5000/api/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    })

    if (response.body && response.ok) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let done = false
      let finalText = ''

      while (!done) {
        const { value, done: doneReading } = await reader.read()
        done = doneReading
        const chunkValue = decoder.decode(value)
        finalText += chunkValue
      }

      const responseMessage: IChatMessage = {
        id: nanoid(),
        isUserMessage: false,
        text: finalText.replace(/['"]+/g, ''),
      }

      removeMessage('loadingMessage')

      setIsDisabled(false)
      addMessage(responseMessage)
    }
  }

  return (
    <TextField
      value={input}
      label="Write a message..."
      variant="standard"
      disabled={isDisabled}
      sx={{
        width: '100%',
      }}
      onChange={e => setInput(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          setInput('')
          setIsDisabled(true)
          sendMessage(input)
        }
      }}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                disabled={isDisabled}
                color="primary"
                onClick={() => sendMessage(input)}
              >
                <SendIcon />
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  )
}
