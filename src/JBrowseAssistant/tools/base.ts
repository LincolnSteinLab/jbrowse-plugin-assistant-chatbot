import { tool } from '@assistant-ui/react'
import { DynamicStructuredTool } from '@langchain/core/tools'
import z from 'zod'

export const EmptySchema = z.strictObject({})
type Empty = z.infer<typeof EmptySchema>

export interface JBTool<
  DSToolT extends DynamicStructuredTool = DynamicStructuredTool,
> {
  description: string
  parameters: typeof EmptySchema
  execute: ({}: Empty) => DSToolT
}

export function createTool<
  ArgsT,
  DSToolT extends DynamicStructuredTool = DynamicStructuredTool,
>(
  description: string,
  factory_fn: (description: string, args: ArgsT) => DSToolT,
) {
  return (args: ArgsT) =>
    tool({
      description,
      parameters: EmptySchema,
      execute({}: Empty) {
        return factory_fn(description, args)
      },
    }) as JBTool<DSToolT>
}
