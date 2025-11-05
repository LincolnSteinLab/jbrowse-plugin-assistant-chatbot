import { ChatModelProvider } from '../agent/ChatModel'

import { createTool, EmptySchema } from './base'

export const ApiKeyVaultTool = createTool({
  name: 'ApiKeyVault',
  description: '',
  schema: EmptySchema,
  factory_fn:
    ({
      provider,
      getApiKey,
    }: {
      provider: ChatModelProvider
      getApiKey: (provider: ChatModelProvider) => Promise<string | undefined>
    }) =>
    async ({}) =>
      await getApiKey(provider),
})
