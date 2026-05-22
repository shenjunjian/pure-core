import { extend, getGlobalThis } from '@vue/shared'
import { nextTick, queueJob, queuePostFlushCb } from './scheduler.js'

export let isHmrUpdating = false

const map = new Map()

function createRecord(id, initialDef) {
  if (map.has(id)) {
    return false
  }
  map.set(id, {
    initialDef,
    instances: new Set(),
  })
  return true
}

export function registerHMR(instance) {
  const id = instance.type.__hmrId
  if (!id) {
    return
  }
  let record = map.get(id)
  if (!record) {
    createRecord(id, instance.type)
    record = map.get(id)
  }
  record.instances.add(instance)
}

export function unregisterHMR(instance) {
  const id = instance.type.__hmrId
  if (!id) {
    return
  }
  const record = map.get(id)
  if (record) {
    record.instances.delete(instance)
  }
}

function rerender(id, newRender) {
  const record = map.get(id)
  if (!record) {
    return
  }

  record.initialDef.render = newRender

  const instances = [...record.instances]
  for (let i = 0; i < instances.length; i++) {
    const instance = instances[i]
    if (newRender) {
      instance.type.render = newRender
    }
    isHmrUpdating = true
    if (!instance.isUnmounted && instance.hmrRerender) {
      instance.hmrRerender()
    }
    nextTick(() => {
      isHmrUpdating = false
    })
  }
}

function reload(id, newComp) {
  const record = map.get(id)
  if (!record) {
    return
  }

  updateComponentDef(record.initialDef, newComp)

  const instances = [...record.instances]
  let hasCeReload = false
  for (let i = 0; i < instances.length; i++) {
    if (instances[i].ceReload) {
      hasCeReload = true
      break
    }
  }

  if (newComp.__vapor && !hasCeReload) {
    for (let i = 0; i < instances.length; i++) {
      const instance = instances[i]
      if (instance.root && instance.root.ce && instance !== instance.root) {
        instance.root.ce._removeChildStyle(instance.type)
      }
    }
    for (let i = 0; i < instances.length; i++) {
      const instance = instances[i]
      if (instance.hmrReload) {
        instance.hmrReload(newComp)
      }
    }
    return
  }

  for (let i = 0; i < instances.length; i++) {
    const instance = instances[i]
    if (instance.ceReload) {
      instance.ceReload(newComp.styles)
    } else if (instance.parent) {
      queueJob(() => {
        isHmrUpdating = true
        const parent = instance.parent
        if (parent.hmrRerender) {
          parent.hmrRerender()
        }
        nextTick(() => {
          isHmrUpdating = false
        })
      })
    } else if (instance.appContext.reload) {
      instance.appContext.reload()
    } else if (typeof window !== 'undefined') {
      window.location.reload()
    } else {
      console.warn(
        '[HMR] Root or manually mounted instance modified. Full reload required.',
      )
    }

    if (instance.root && instance.root.ce && instance !== instance.root) {
      instance.root.ce._removeChildStyle(instance.type)
    }
  }
}

function updateComponentDef(oldComp, newComp) {
  extend(oldComp, newComp)
  for (const key in oldComp) {
    if (key !== '__file' && !(key in newComp)) {
      delete oldComp[key]
    }
  }
}

function tryWrap(fn) {
  return (id, arg) => {
    try {
      return fn(id, arg)
    } catch (e) {
      console.error(e)
      console.warn(
        '[HMR] Something went wrong during Vue component hot-reload. ' +
          'Full reload required.',
      )
    }
  }
}

if (__DEV__) {
  getGlobalThis().__VUE_HMR_RUNTIME__ = {
    createRecord: tryWrap(createRecord),
    rerender: tryWrap(rerender),
    reload: tryWrap(reload),
  }
}
