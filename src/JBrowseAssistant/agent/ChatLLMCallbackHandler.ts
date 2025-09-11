import { BaseCallbackHandler } from '@langchain/core/callbacks/base'
import { Serialized } from '@langchain/core/load/serializable'

export default class ChatLLMCallbackHandler extends BaseCallbackHandler {
  name = 'JBrowseChatLLMCallbackHandler'

  private chatModelType?: string

  handleChatModelStart(llm: Serialized) {
    this.chatModelType = llm.id.at(-1)
  }

  handleLLMError(err: TypeError) {
    err.message = `${this.chatModelType} Error: ${err.message}`
  }
}
