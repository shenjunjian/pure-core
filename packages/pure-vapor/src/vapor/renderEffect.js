import { EffectFlags, ReactiveEffect } from '@vue/reactivity'
import { invokeArrayFns } from '@vue/shared'
import {
  SchedulerJobFlags,
  endMeasure,
  queueJob,
  queuePostFlushCb,
  startMeasure,
} from '../internal/index.js'
import { isVaporComponent } from './component.js'
import { inOnceSlot } from './componentSlots.js'
import { currentInstance, setCurrentInstance } from '../internal/instance.js'
import { warn } from '../internal/warning.js'

export class RenderEffect extends ReactiveEffect {
  constructor(render, noLifecycle = false) {
    super(noLifecycle ? render : undefined)
    this.render = render
    const instance = currentInstance
    if (__DEV__ && !__TEST__ && !this.subs && !isVaporComponent(instance)) {
      warn('renderEffect called without active EffectScope or Vapor instance.')
    }

    const job = () => {
      if (this.dirty) {
        this.run()
      }
    }

    if (instance) {
      if (__DEV__ && !noLifecycle) {
        this.onTrack = instance.rtc
          ? e => invokeArrayFns(instance.rtc, e)
          : void 0
        this.onTrigger = instance.rtg
          ? e => invokeArrayFns(instance.rtg, e)
          : void 0
      }

      if (instance.type && instance.type.ce) {
        const effects = instance.renderEffects || (instance.renderEffects = [])
        effects.push(this)
      }
      job.i = instance
    }

    this.job = job
    this.i = instance

    this.flags |= EffectFlags.ALLOW_RECURSE
    this.job.flags |= SchedulerJobFlags.ALLOW_RECURSE
  }

  fn() {
    const instance = this.i
    const scope = this.subs ? this.subs.sub : undefined
    const hasUpdateHooks = instance && (instance.bu || instance.u)
    if (__DEV__ && instance) {
      startMeasure(instance, 'renderEffect')
    }
    const prev = setCurrentInstance(instance, scope)
    try {
      if (hasUpdateHooks && instance.isMounted && !instance.isUpdating) {
        instance.isUpdating = true
        try {
          if (instance.bu) invokeArrayFns(instance.bu)
          this.render()
        } catch (err) {
          instance.isUpdating = false
          throw err
        }
        let updateJob = this.updateJob
        if (!updateJob) {
          updateJob = this.updateJob = () => {
            instance.isUpdating = false
            if (instance.u) invokeArrayFns(instance.u)
          }
        }
        queuePostFlushCb(updateJob)
      } else {
        this.render()
      }
    } finally {
      setCurrentInstance(...prev)
      if (__DEV__ && instance) {
        endMeasure(instance, 'renderEffect')
      }
    }
  }

  notify() {
    const flags = this.flags
    if (!(flags & EffectFlags.PAUSED)) {
      queueJob(this.job, this.i ? this.i.uid : undefined)
    }
  }
}

export function renderEffect(fn, noLifecycle = false) {
  if (inOnceSlot) return fn()

  const effect = new RenderEffect(fn, noLifecycle)
  effect.run()
}
