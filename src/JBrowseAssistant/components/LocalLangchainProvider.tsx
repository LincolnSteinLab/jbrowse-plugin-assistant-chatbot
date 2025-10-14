import {
  AssistantRuntimeProvider,
  ChatModelRunOptions,
  ChatModelRunResult,
  RuntimeAdapterProvider,
  ThreadHistoryAdapter,
  useLocalThreadRuntime,
  useThreadListItem,
} from '@assistant-ui/react'
import {
  RemoteThreadListAdapter,
  RemoteThreadMetadata,
} from '@assistant-ui/react/dist/runtimes/remote-thread-list/types'
import { useRemoteThreadListRuntime } from '@assistant-ui/react/dist/runtimes/remote-thread-list/useRemoteThreadListRuntime'
import {
  ExportedMessageRepository,
  ExportedMessageRepositoryItem,
} from '@assistant-ui/react/dist/runtimes/utils/MessageRepository'
import { createAssistantStream } from 'assistant-stream'
import { DBSchema, openDB } from 'idb'
import React, { PropsWithChildren, ReactNode, useMemo } from 'react'

import { LocalLangchainAdapter } from '../LocalLangchainAdapter'

interface ThreadListDB extends DBSchema {
  threads: {
    key: string
    value: {
      metadata: RemoteThreadMetadata
      headId: ExportedMessageRepository['headId']
    }
  }
  messages: {
    key: number
    value: {
      threadId: string
      item: ExportedMessageRepositoryItem
    }
    indexes: {
      thread: string
    }
  }
}

async function openThreadListDB() {
  return await openDB<ThreadListDB>('chatbot-threads', 1, {
    upgrade(db) {
      db.createObjectStore('threads', { keyPath: 'metadata.remoteId' })
      db.createObjectStore('messages', {
        keyPath: 'item.message.id',
      }).createIndex('thread', 'threadId')
    },
  })
}

async function putThreadMetadata<K extends keyof RemoteThreadMetadata>(
  remoteId: string,
  metaKey: K,
  metaValue: RemoteThreadMetadata[K],
) {
  const db = await openThreadListDB()
  const tx = db.transaction('threads', 'readwrite')
  const thread = await tx.store.get(remoteId)
  if (!thread) return
  thread.metadata = {
    ...thread.metadata,
    [metaKey]: metaValue,
  }
  await tx.store.put(thread, remoteId)
  await tx.done
}

const browserThreadListAdapter: RemoteThreadListAdapter = {
  async list() {
    const db = await openThreadListDB()
    const tx = db.transaction('threads')
    const threads: RemoteThreadMetadata[] = []
    for await (const cursor of tx.store) {
      threads.push(cursor.value.metadata)
    }
    await tx.done
    return { threads }
  },
  async initialize(threadId: string) {
    const db = await openThreadListDB()
    await db.add(
      'threads',
      {
        metadata: {
          status: 'regular',
          remoteId: threadId,
        },
        headId: undefined,
      },
      threadId,
    )
    return { remoteId: threadId, externalId: undefined }
  },
  async rename(remoteId: string, newTitle: string) {
    await putThreadMetadata(remoteId, 'title', newTitle)
  },
  async archive(remoteId: string) {
    await putThreadMetadata(remoteId, 'status', 'archived')
  },
  async unarchive(remoteId: string) {
    await putThreadMetadata(remoteId, 'status', 'regular')
  },
  async delete(remoteId: string) {
    const db = await openThreadListDB()
    const tx = db.transaction(['threads', 'messages'], 'readwrite')
    await tx.objectStore('threads').delete(remoteId)
    for await (const cursor of tx
      .objectStore('messages')
      .index('thread')
      .iterate(remoteId)) {
      await cursor.delete()
    }
    await tx.done
  },
  // eslint-disable-next-line @typescript-eslint/require-await
  async generateTitle(remoteId: string) {
    return createAssistantStream(controller => {
      controller.appendText(remoteId) // TODO: generate titles
      controller.close()
    })
  },
  unstable_Provider: function Provider({ children }: PropsWithChildren) {
    const threadListItem = useThreadListItem()
    const { remoteId } = threadListItem
    const history = useMemo<ThreadHistoryAdapter>(
      () => ({
        async load() {
          if (!remoteId) return { messages: [] }
          const db = await openThreadListDB()
          const tx = db.transaction(['threads', 'messages'])
          // Get headId from thread (last active message)
          const headId = (await tx.objectStore('threads').get(remoteId))?.headId
          // Get all thread messages
          const messages = (
            await tx.objectStore('messages').index('thread').getAll(remoteId)
          ).map(({ item }) => item)
          await tx.done
          return {
            headId,
            messages,
          }
        },
        async append(item: ExportedMessageRepositoryItem) {
          if (!remoteId) return
          const db = await openThreadListDB()
          const tx = db.transaction(['threads', 'messages'], 'readwrite')
          // Update thread headId with new message.id
          const threadsStore = tx.objectStore('threads')
          const thread = await threadsStore.get(remoteId)
          if (!thread) return
          thread.headId = item.message.id
          // Add to messages store
          await tx.objectStore('messages').add({
            threadId: remoteId,
            item,
          })
          await threadsStore.put(thread, remoteId)
          await tx.done
        },
        async *resume(options: ChatModelRunOptions) {
          const { messages } = options
          if (messages[messages.length - 1].role === 'user') {
            yield* LocalLangchainAdapter.run(options) as AsyncGenerator<
              ChatModelRunResult,
              void
            >
          }
        },
      }),
      [remoteId],
    )
    const adapters = useMemo(() => ({ history }), [history])
    return (
      <RuntimeAdapterProvider adapters={adapters}>
        {children}
      </RuntimeAdapterProvider>
    )
  },
}

export function LocalLangchainProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const runtime = useRemoteThreadListRuntime({
    runtimeHook: function LocalLangchainRuntime() {
      return useLocalThreadRuntime(LocalLangchainAdapter, {})
    },
    adapter: browserThreadListAdapter,
  })
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  )
}
