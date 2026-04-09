export type ToolStatus = 'ok' | 'needs_input' | 'error'

export interface ToolEnvelope<TData = unknown> {
  status: ToolStatus
  message: string
  data?: TData
  suggestions?: string[]
}

export function ok<TData>(
  message: string,
  data?: TData,
  suggestions?: string[],
): ToolEnvelope<TData> {
  return { status: 'ok', message, data, suggestions }
}

export function needsInput<TData>(
  message: string,
  data?: TData,
  suggestions?: string[],
): ToolEnvelope<TData> {
  return { status: 'needs_input', message, data, suggestions }
}

export function err<TData>(
  message: string,
  data?: TData,
  suggestions?: string[],
): ToolEnvelope<TData> {
  return { status: 'error', message, data, suggestions }
}
