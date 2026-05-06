import { WebModelContextInitOptions } from '@mcp-b/global'
import { createTheme } from '@mui/material'

declare module '*.json'

declare module '@mui/material' {
  type ThemeOptions = Parameters<typeof createTheme>[0]
}

declare global {
  interface Window {
    __webModelContextOptions?: WebModelContextInitOptions
  }
}
