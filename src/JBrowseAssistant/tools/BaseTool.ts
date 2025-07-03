import { Tool } from '@assistant-ui/react'
import { DynamicStructuredTool } from '@langchain/core/tools'
import z from 'zod'

export const EmptySchema = z.strictObject({})
type Empty = z.infer<typeof EmptySchema>

export abstract class BaseTool<
  DSToolT extends DynamicStructuredTool = DynamicStructuredTool,
> implements Tool<Empty, DSToolT>
{
  parameters = EmptySchema

  execute({}: Empty) {
    return this.lc_tool
  }

  abstract description: string
  protected lc_tool: DSToolT = {} as DSToolT
}
