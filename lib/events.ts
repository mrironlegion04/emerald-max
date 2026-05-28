import { EventEmitter } from 'events'

const globalForEvents = globalThis as unknown as {
  notificationEmitter: EventEmitter | undefined
}

export const notificationEmitter =
  globalForEvents.notificationEmitter ?? new EventEmitter()

if (process.env.NODE_ENV !== 'production') {
  globalForEvents.notificationEmitter = notificationEmitter
}
