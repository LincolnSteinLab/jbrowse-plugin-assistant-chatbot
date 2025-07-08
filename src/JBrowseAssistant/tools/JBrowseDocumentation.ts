import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import { GithubRepoLoader } from '@langchain/community/document_loaders/web/github'
import { BM25Retriever } from '@langchain/community/retrievers/bm25'
import {
  DocumentInterface,
  MappingDocumentTransformer,
} from '@langchain/core/documents'
import { MessageContentComplex } from '@langchain/core/messages'
import { InMemoryStore } from '@langchain/core/stores'
import { DynamicStructuredTool } from '@langchain/core/tools'
import {
  MarkdownTextSplitter,
  TokenTextSplitter,
} from '@langchain/textsplitters'
import { ParentDocumentRetriever } from 'langchain/retrievers/parent_document'
import { MemoryVectorStore } from 'langchain/vectorstores/memory'
import { z } from 'zod'

import { EmbeddingsSpec } from '../agent/ChatAgent'

import { BaseTool } from './BaseTool'

const docsLocalStorageKey = 'chatbot-jb-docs'
const vectorStoreLocalStoragePrefix = 'chatbot-jb-vectorstore-'

const QuerySchema = z.strictObject({
  query: z.string(),
})

class JBrowseDocumentTransformer extends MappingDocumentTransformer {
  // eslint-disable-next-line @typescript-eslint/require-await
  async _transformDocument(
    document: DocumentInterface,
  ): Promise<DocumentInterface> {
    const match =
      /^(?=(?:---\n(?:(?!title).*\n)*title: |(?:(?!#).*\n)*# )(?<title>.*))(?:---\n(?:(?!---).*\n)*---\n(?:(?:import.*|# .*|)\n)*|(?:(?!#).*\n)*#.*\n+)(?<content>(?:.|\n)*)/.exec(
        document.pageContent,
      )
    if (!match) {
      console.log(document.metadata)
      console.log(document.pageContent)
    }
    return {
      id: match?.groups?.id,
      metadata: document.metadata,
      pageContent: `# ${match?.groups?.title ?? ''}\n\n${match?.groups?.content ?? ''}`,
    }
  }
}

async function fetchJBrowseDocuments() {
  const docsStr = localStorageGetItem(docsLocalStorageKey)
  if (docsStr) {
    const documents = JSON.parse(docsStr) as DocumentInterface[]
    return Array.isArray(documents) ? documents : []
  }
  const loader = new GithubRepoLoader(
    'https://github.com/GMOD/jbrowse-components/tree/main/website',
    {
      recursive: true,
      ignoreFiles: [
        /(README|SCREENSHOTS|title|\/(config|models)\/.*)\.md|^(?!.+\.mdx?$).+/,
      ],
    },
  )
  const transformer = new JBrowseDocumentTransformer()
  let documents: DocumentInterface[]
  try {
    documents = await transformer.transformDocuments(await loader.load())
  } catch (error) {
    console.error('Failed to load JBrowse website from GitHub', error)
    return []
  }
  localStorageSetItem(docsLocalStorageKey, JSON.stringify(documents))
  return documents
}

async function getJBrowseVectorRetriever({
  embeddings,
  config_id,
}: EmbeddingsSpec) {
  // Set up the vector store and retriever
  const vectorstore = new MemoryVectorStore(embeddings)
  const byteStore = new InMemoryStore<Uint8Array>()
  const retriever = new ParentDocumentRetriever({
    vectorstore,
    byteStore,
    parentSplitter: new MarkdownTextSplitter({
      chunkSize: 10000,
      chunkOverlap: 20,
    }),
    childSplitter: new TokenTextSplitter({
      chunkSize: 500,
      chunkOverlap: 0,
    }),
    childK: 20,
    parentK: 10,
  })

  // Restore from cached vectors from localStorage, if they exist
  const vectorStoreKey = vectorStoreLocalStoragePrefix + config_id
  const vectorStr = localStorageGetItem(vectorStoreKey)
  if (vectorStr) {
    const {
      memoryVectors,
      store,
    }: {
      memoryVectors: MemoryVectorStore['memoryVectors']
      store: Record<string, Uint8Array>
    } = JSON.parse(vectorStr)
    vectorstore.memoryVectors = memoryVectors
    await byteStore.mset(Object.entries(store))
    return retriever
  }

  // Otherwise, fetch the documents and add them to the retriever
  const documents = await fetchJBrowseDocuments()
  if (!documents?.length) {
    return null
  }
  await retriever.addDocuments(documents)

  // Cache vectors to localStorage for next time
  const store_keys: string[] = []
  for await (const key of byteStore.yieldKeys()) {
    store_keys.push(key)
  }
  console.log(vectorstore.memoryVectors)
  console.log(await byteStore.mget(store_keys))
  /*localStorageSetItem(
    vectorStoreKey,
    JSON.stringify({
      memoryVectors: vectorstore.memoryVectors,
      store: await byteStore.mget(store_keys),
    }),
  )*/

  return retriever
}

const description =
  'Query for JBrowse website pages (in English) using a vector similarity search.'

function getJBrowseDocumentationTool() {
  return new DynamicStructuredTool({
    name: 'JBrowseDocumentation',
    description: description,
    schema: QuerySchema,
    func: async ({ query }) => {
      console.log(query)
      /*
      const config = config_ as RunConfig
      if (!config?.configurable?.embeddings_spec) {
        return 'This tool is not working; avoid using'
      }
      let retriever: BaseRetriever | null = null
      try {
        retriever = await getJBrowseVectorRetriever(
          config.configurable.embeddings_spec,
        )
      } catch (error) {
        console.error('Failed to get JBrowse retriever', error)
      }
      if (!retriever) {
        return 'JBrowse website lookup not available; avoid using'
      }
      retriever = BM25Retriever.fromDocuments(
        await retriever.invoke(query),
        { k: 5 },
      )
      */
      const retriever = BM25Retriever.fromDocuments(
        await fetchJBrowseDocuments(),
        { k: 5 },
      )
      const results = await retriever.invoke(query)
      const content: MessageContentComplex = { type: 'text' }
      for (const [i, doc] of results.entries()) {
        content[doc.metadata.source ?? i] = doc.pageContent
      }
      return content
    },
  })
}

export class JBrowseDocumentationTool extends BaseTool<
  ReturnType<typeof getJBrowseDocumentationTool>
> {
  description = description

  constructor() {
    super()
    this.lc_tool = getJBrowseDocumentationTool()
  }
}
