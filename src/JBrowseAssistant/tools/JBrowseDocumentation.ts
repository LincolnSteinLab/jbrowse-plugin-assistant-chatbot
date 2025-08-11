import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import { GithubRepoLoader } from '@langchain/community/document_loaders/web/github'
import { BM25Retriever } from '@langchain/community/retrievers/bm25'
import {
  DocumentInterface,
  MappingDocumentTransformer,
} from '@langchain/core/documents'
import { MessageContentComplex } from '@langchain/core/messages'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

import { createTool } from './factory'

const docsLocalStorageKey = 'chatbot-jb-docs'

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
        /(README|SCREENSHOTS|title|\/(blog|config|models)\/.*)\.md|^(?!.+\.mdx?$).+/,
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

export const JBrowseDocumentationTool = createTool(
  'Search JBrowse website pages (in English) using a simple bag-of-words search',
  description =>
    new DynamicStructuredTool({
      name: 'JBrowseDocumentation',
      description,
      schema: z.strictObject({
        query: z.string(),
      }),
      func: async ({ query }) => {
        console.log(query)
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
    }),
)
