import { isArray } from '@vue/shared'
import { getComponentName } from './component.js'
import { ErrorCodes, handleError } from './errorHandling.js'

export const SchedulerJobFlags = {
  QUEUED: 1 << 0,
  ALLOW_RECURSE: 1 << 1,
  DISPOSED: 1 << 2,
}

const jobs = []
let postJobs = []
let activePostJobs = null
let currentFlushPromise = null
let jobsLength = 0
let flushIndex = 0
let postFlushIndex = 0

const resolvedPromise = /*@__PURE__*/ Promise.resolve()
const RECURSION_LIMIT = 100

export function nextTick(fn) {
  const p = currentFlushPromise || resolvedPromise
  return fn ? p.then(fn) : p
}

function findInsertionIndex(order, queue, start, end) {
  while (start < end) {
    const middle = (start + end) >>> 1
    if (queue[middle].order <= order) {
      start = middle + 1
    } else {
      end = middle
    }
  }
  return start
}

export function queueJob(job, id, isPre = false) {
  if (
    queueJobWorker(
      job,
      id === undefined ? (isPre ? -2 : Infinity) : isPre ? id * 2 : id * 2 + 1,
      jobs,
      jobsLength,
      flushIndex,
    )
  ) {
    jobsLength++
    queueFlush()
  }
}

function queueJobWorker(job, order, queue, length, flushIdx) {
  const flags = job.flags
  if (!(flags & SchedulerJobFlags.QUEUED)) {
    job.flags = flags | SchedulerJobFlags.QUEUED
    job.order = order
    if (flushIdx === length || order >= queue[length - 1].order) {
      queue[length] = job
    } else {
      queue.splice(findInsertionIndex(order, queue, flushIdx, length), 0, job)
    }
    return true
  }
  return false
}

const doFlushJobs = () => {
  try {
    flushJobs()
  } catch (e) {
    currentFlushPromise = null
    throw e
  }
}

function queueFlush() {
  if (!currentFlushPromise) {
    currentFlushPromise = resolvedPromise.then(doFlushJobs)
  }
}

export function queuePostFlushCb(cbs, id = Infinity) {
  if (!isArray(cbs)) {
    if (activePostJobs && id === -1) {
      activePostJobs.splice(postFlushIndex, 0, cbs)
    } else {
      queueJobWorker(cbs, id, postJobs, postJobs.length, 0)
    }
  } else {
    for (const job of cbs) {
      queueJobWorker(job, id, postJobs, postJobs.length, 0)
    }
  }
  queueFlush()
}

export function flushPreFlushCbs(instance, seen) {
  if (__DEV__) {
    seen = seen || new Map()
  }
  for (let i = flushIndex; i < jobsLength; i++) {
    const cb = jobs[i]
    if (cb.order & 1 || cb.order === Infinity) {
      continue
    }
    if (instance && cb.order !== instance.uid * 2) {
      continue
    }
    if (__DEV__ && checkRecursiveUpdates(seen, cb)) {
      continue
    }
    jobs.splice(i, 1)
    i--
    jobsLength--
    if (cb.flags & SchedulerJobFlags.ALLOW_RECURSE) {
      cb.flags &= ~SchedulerJobFlags.QUEUED
    }
    cb()
    if (!(cb.flags & SchedulerJobFlags.ALLOW_RECURSE)) {
      cb.flags &= ~SchedulerJobFlags.QUEUED
    }
  }
}

export function flushPostFlushCbs(seen) {
  if (postJobs.length) {
    if (activePostJobs) {
      activePostJobs.push(...postJobs)
      postJobs.length = 0
      return
    }

    activePostJobs = postJobs
    postJobs = []

    if (__DEV__) {
      seen = seen || new Map()
    }

    while (postFlushIndex < activePostJobs.length) {
      const cb = activePostJobs[postFlushIndex++]
      if (__DEV__ && checkRecursiveUpdates(seen, cb)) {
        continue
      }
      if (cb.flags & SchedulerJobFlags.ALLOW_RECURSE) {
        cb.flags &= ~SchedulerJobFlags.QUEUED
      }
      if (!(cb.flags & SchedulerJobFlags.DISPOSED)) {
        try {
          cb()
        } finally {
          cb.flags &= ~SchedulerJobFlags.QUEUED
        }
      }
    }

    activePostJobs = null
    postFlushIndex = 0
  }
}

let isFlushing = false

export function flushOnAppMount(instance) {
  if (!isFlushing) {
    isFlushing = true
    flushPreFlushCbs(instance)
    flushPostFlushCbs()
    isFlushing = false
  }
}

function flushJobs(seen) {
  if (__DEV__) {
    seen = seen || new Map()
  }

  try {
    while (flushIndex < jobsLength) {
      const job = jobs[flushIndex]
      jobs[flushIndex++] = undefined

      if (!(job.flags & SchedulerJobFlags.DISPOSED)) {
        if (__DEV__ && checkRecursiveUpdates(seen, job)) {
          continue
        }
        if (job.flags & SchedulerJobFlags.ALLOW_RECURSE) {
          job.flags &= ~SchedulerJobFlags.QUEUED
        }
        try {
          job()
        } catch (err) {
          handleError(
            err,
            job.i,
            job.i ? ErrorCodes.COMPONENT_UPDATE : ErrorCodes.SCHEDULER,
          )
        } finally {
          if (!(job.flags & SchedulerJobFlags.ALLOW_RECURSE)) {
            job.flags &= ~SchedulerJobFlags.QUEUED
          }
        }
      }
    }
  } finally {
    while (flushIndex < jobsLength) {
      jobs[flushIndex].flags &= ~SchedulerJobFlags.QUEUED
      jobs[flushIndex++] = undefined
    }

    flushIndex = 0
    jobsLength = 0

    flushPostFlushCbs(seen)

    currentFlushPromise = null
    if (jobsLength || postJobs.length) {
      flushJobs(seen)
    }
  }
}

/** 用来取消尚未执行的 mounted / activated 后置回调，
 * 避免组件已经卸载或失活后，这些钩子仍被调度器执行
 *
 * hook.flags 未提前赋值。 位运算会把操作数转成 32 位整数：undefined 先变成 NaN，再变成 0。
 * */
export function invalidateMount(hooks) {
  if (hooks) {
    for (let i = 0; i < hooks.length; i++) {
      hooks[i].flags |= SchedulerJobFlags.DISPOSED
    }
  }
}

function checkRecursiveUpdates(seen, fn) {
  const count = seen.get(fn) || 0
  if (count > RECURSION_LIMIT) {
    const instance = fn.i
    const componentName = instance && getComponentName(instance.type)
    handleError(
      `Maximum recursive updates exceeded${
        componentName ? ` in component <${componentName}>` : ``
      }. ` +
        `This means you have a reactive effect that is mutating its own ` +
        `dependencies and thus recursively triggering itself. Possible sources ` +
        `include component template, render function, updated hook or ` +
        `watcher source function.`,
      null,
      ErrorCodes.APP_ERROR_HANDLER,
    )
    return true
  }
  seen.set(fn, count + 1)
  return false
}
