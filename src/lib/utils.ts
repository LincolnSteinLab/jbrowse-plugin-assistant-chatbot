import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function withExceptionCapturing<S, T extends unknown[]>(
  fn: (...rest: T) => Promise<S>,
) {
  return (...args: T) => {
    fn(...args).catch(error => {
      console.error('Unexpected error', error)
    })
  }
}

function isWebWorker() {
  return (
    // @ts-expect-error WebWorker lib
    typeof WorkerGlobalScope !== 'undefined' &&
    // @ts-expect-error WebWorker lib
    self instanceof WorkerGlobalScope
  )
}

if (isWebWorker()) {
  // Prevent MCP-B from auto-initializing in Web Workers
  window.__webModelContextOptions = { autoInitialize: false }
}
