import { SchedulerJobFlags } from '../internal/scheduler.js'

export const refCleanups = new WeakMap()

export function invalidatePendingRef(el) {
  const c = refCleanups.get(el)
  if (c && c.job) {
    c.job.flags = c.job.flags | SchedulerJobFlags.DISPOSED
    c.job = undefined
  }
}

export function unsetRef(el) {
  invalidatePendingRef(el)
  const c = refCleanups.get(el)
  if (c) c.fn()
}
