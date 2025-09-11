import { AIMessageChunk } from '@langchain/core/messages'

const THINK_START = '<think>'
const THINK_END = '</think>'

export class ResponseParser {
  private last_text = ''
  private is_reasoning_parsing_enabled = false
  private is_reasoning = false

  resetParser = () => {
    this.is_reasoning_parsing_enabled = false
    this.is_reasoning = false
    this.last_text = ''
  }

  enableReasoningParsing = () => {
    this.is_reasoning_parsing_enabled = true
    this.is_reasoning = false
  }

  parseResponse = (message: AIMessageChunk) => {
    this.last_text += message.text
    if (!this.is_reasoning_parsing_enabled) return message
    message.additional_kwargs = message.additional_kwargs ?? {}
    const buffer = THINK_END.length - 1
    if (this.is_reasoning) {
      // currently inside a <think> ... looking for THINK_END
      const endIdx = this.last_text.indexOf(THINK_END)
      if (endIdx === -1) {
        // no end yet: emit everything except the tail buffer as reasoning
        if (this.last_text.length > buffer) {
          message.additional_kwargs.reasoning_content = this.last_text.slice(
            0,
            -buffer,
          )
          message.content = ''
          this.last_text = this.last_text.slice(-buffer)
        } else {
          // not enough data to emit yet
          message.additional_kwargs.reasoning_content = ''
          message.content = ''
        }
      } else {
        // found end tag
        const reasoning = this.last_text.slice(0, endIdx)
        const after = this.last_text.slice(endIdx + THINK_END.length)
        message.additional_kwargs.reasoning_content = reasoning
        if (after.length > buffer) {
          message.content = after.slice(0, -buffer)
          this.last_text = after.slice(-buffer)
        } else {
          message.content = after
          this.last_text = ''
        }
        this.is_reasoning = false
      }
    } else {
      // currently outside reasoning, look for THINK_START
      const startIdx = this.last_text.indexOf(THINK_START)
      if (startIdx === -1) {
        // no start found: emit everything except the tail buffer
        if (this.last_text.length > buffer) {
          message.content = this.last_text.slice(0, -buffer)
          this.last_text = this.last_text.slice(-buffer)
        } else {
          // not enough data to emit yet
          message.content = ''
        }
      } else {
        // found a start tag
        const content = this.last_text.slice(0, startIdx)
        const endIdx = this.last_text.indexOf(
          THINK_END,
          startIdx + THINK_START.length,
        )
        if (endIdx === -1) {
          // reasoning starts here but doesn't end yet
          const reasoningTail = this.last_text.slice(
            startIdx + THINK_START.length,
          )
          if (reasoningTail.length > buffer) {
            message.additional_kwargs.reasoning_content = reasoningTail.slice(
              0,
              -buffer,
            )
            this.last_text = reasoningTail.slice(-buffer)
          } else {
            message.additional_kwargs.reasoning_content = reasoningTail
            this.last_text = ''
          }
          message.content = content
          this.is_reasoning = true
        } else {
          // complete <think>...</think> exists in buffer
          const reasoning = this.last_text.slice(
            startIdx + THINK_START.length,
            endIdx,
          )
          const after = this.last_text.slice(endIdx + THINK_END.length)
          if (after.length > buffer) {
            message.content = content + after.slice(0, -buffer)
            this.last_text = after.slice(-buffer)
          } else {
            message.content = content + after
            this.last_text = ''
          }
          message.additional_kwargs.reasoning_content = reasoning
          this.is_reasoning = false
        }
      }
    }
    return message
  }

  finalParsedChunk = () => {
    if (!this.is_reasoning_parsing_enabled || this.last_text.length === 0)
      return
    if (this.is_reasoning) {
      return new AIMessageChunk({
        additional_kwargs: { reasoning_content: this.last_text },
        content: '',
      })
    } else {
      return new AIMessageChunk({ content: this.last_text })
    }
  }
}
