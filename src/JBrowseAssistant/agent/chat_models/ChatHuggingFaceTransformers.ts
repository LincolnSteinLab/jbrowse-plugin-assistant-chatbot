import {
  type TextGenerationConfig,
  type PretrainedModelOptions,
  type TextGenerationPipeline,
  type Chat,
  type TextGenerationSingle,
  TextStreamer,
  pipeline,
} from '@huggingface/transformers'
import {
  BaseChatModelParams,
  SimpleChatModel,
} from '@langchain/core/language_models/chat_models'
import {
  AIMessageChunk,
  BaseMessage,
  MessageContentText,
} from '@langchain/core/messages'
import { ChatGenerationChunk } from '@langchain/core/outputs'

class TextStreamerWithStatus extends TextStreamer {
  is_streaming = true

  on_finalized_text(text: string, stream_end: boolean): void {
    super.on_finalized_text(text, stream_end)
    this.is_streaming = !stream_end
  }
}

export interface ChatHuggingFaceTransformersFields extends BaseChatModelParams {
  model: string
  pretrainedOptions?: PretrainedModelOptions
  pipelineOptions?: Partial<TextGenerationConfig>
}

export class ChatHuggingFaceTransformers extends SimpleChatModel {
  model: string
  pretrainedOptions?: PretrainedModelOptions
  pipelineOptions?: Partial<TextGenerationConfig>

  private pipelinePromise: Promise<TextGenerationPipeline> | null = null

  constructor(fields: ChatHuggingFaceTransformersFields) {
    super(fields)
    this.model = fields.model
    this.pretrainedOptions = fields.pretrainedOptions
    this.pipelineOptions = fields.pipelineOptions
  }

  _llmType() {
    return 'huggingface-transformers'
  }

  private async getPipeline() {
    if (!this.pipelinePromise) {
      // @ts-expect-error : huge union type, but always the same in this case
      this.pipelinePromise = pipeline(
        'text-generation',
        this.model,
        this.pretrainedOptions,
      )
    }
    return this.pipelinePromise
  }

  private convertMessagesToChat(messages: BaseMessage[]): Chat {
    return messages.map(message => {
      let role: string
      switch (message.getType()) {
        case 'system':
          role = 'system'
          break
        case 'human':
          role = 'user'
          break
        default:
          role = 'assistant'
      }
      const content =
        typeof message.content === 'string'
          ? message.content
          : message.content
              .filter(cnt => cnt.type === 'text' && cnt.text)
              .map(cnt => (cnt as MessageContentText).text)
              .join('\f')
      return {
        role,
        content,
      }
    })
  }

  async _call(messages: BaseMessage[]): Promise<string> {
    const input_chat = this.convertMessagesToChat(messages)
    const generator = await this.getPipeline()

    // The following type casts are valid for non-batched Chat inputs
    const output = (await generator(
      input_chat,
      this.pipelineOptions,
    )) as TextGenerationSingle[]
    console.log(output)
    const output_chat = output[0].generated_text as Chat
    return output_chat[output_chat.length - 1].content
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
  ): AsyncGenerator<ChatGenerationChunk> {
    const input_chat = this.convertMessagesToChat(messages)
    const generator = await this.getPipeline()
    const chunks: ChatGenerationChunk[] = []
    let notify: (() => void) | null = null
    const streamer = new TextStreamerWithStatus(generator.tokenizer, {
      skip_prompt: true,
      callback_function: (text: string) => {
        chunks.push(
          new ChatGenerationChunk({
            message: new AIMessageChunk({ content: text }),
            text,
          }),
        )
        if (notify) {
          notify()
          notify = null
        }
      },
    })
    const generation = generator(input_chat, {
      ...this.pipelineOptions,
      streamer,
    })
    let chunk: ChatGenerationChunk | undefined
    while (streamer.is_streaming) {
      await new Promise<void>(resolve => {
        notify = resolve
      })
      while ((chunk = chunks.shift())) {
        yield chunk
      }
    }
    for (chunk of chunks) {
      yield chunk
    }
    await generation
  }
}
