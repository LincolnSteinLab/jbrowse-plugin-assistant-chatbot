import { ChatModelAdapter, Thread, useLocalRuntime } from '@assistant-ui/react'
import React from 'react'
import { createGlobalStyle } from 'styled-components';
import styles from '@assistant-ui/react/styles/index.css';

const LocalLangchainAdapter: ChatModelAdapter = {
  async *run({ messages, abortSignal, config }) {
    const stream = '...'
  }
}

const AssistantUIStyle = createGlobalStyle`${styles}`

export default function ReactComponent() {
  const runtime = useLocalRuntime(LocalLangchainAdapter)
  return (
    <div>
      <AssistantUIStyle />
      <div className='h-full'>
        <Thread runtime={runtime} />
      </div>
    </div>
  )
}
