import { ReactiveEffect } from '@vue/reactivity'
import { queueJob, queuePostFlushCb } from './scheduler.js'

export function watch(source, cb, options = {}) {
  const getter = typeof source === 'function' ? source : () => source
  let oldValue
  const flush = options.flush || 'pre'

  const job = () => {
    const newValue = getter()
    if (newValue !== oldValue || options.deep) {
      const prev = oldValue
      oldValue = newValue
      cb(newValue, prev)
    }
  }

  const effect = new ReactiveEffect(getter, () => {
    if (flush === 'sync') {
      job()
    } else if (flush === 'post') {
      queuePostFlushCb(job)
    } else {
      queueJob(job)
    }
  })

  if (options.immediate) {
    oldValue = getter()
    cb(oldValue, undefined)
  } else {
    oldValue = getter()
  }

  effect.run()

  return () => effect.stop()
}
