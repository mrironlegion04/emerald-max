export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

function timestamp(): string {
  return new Date().toISOString()
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const line = JSON.stringify({ ts: timestamp(), level, message, ...meta })
  // console.* is available in both the Node and Edge runtimes.
  if (level === 'error') {
    console.error(line)
  } else {
    console.log(line)
  }
}

/**
 * Minimal structured logger writing JSON lines to stdout/stderr.
 * No dependencies; parseable by any log collector.
 */
export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    emit('debug', message, meta)
  },
  info(message: string, meta?: Record<string, unknown>) {
    emit('info', message, meta)
  },
  warn(message: string, meta?: Record<string, unknown>) {
    emit('warn', message, meta)
  },
  error(message: string, meta?: Record<string, unknown>) {
    emit('error', message, meta)
  },
}
