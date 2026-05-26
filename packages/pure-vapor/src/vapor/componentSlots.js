import { EMPTY_OBJ, NO, hasOwn, isArray, isFunction } from '@vue/shared'
import { insert } from './block.js'
import {
  rawPropsProxyHandlers,
  resolveFunctionSource,
} from './componentProps.js'
import { currentInstance } from '../internal/instance.js'
import { renderEffect } from './renderEffect.js'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
} from './insertionState.js'
import { SlotFragment } from './fragment.js'
import { setScopeId } from './scopeId.js'

export let inOnceSlot = false

export let currentSlotOwner = null

export function setCurrentSlotOwner(owner) {
  const prev = currentSlotOwner
  currentSlotOwner = owner
  return prev
}

export const dynamicSlotsProxyHandlers = {
  get: getSlot,
  has: (target, key) => !!getSlot(target, key),
  getOwnPropertyDescriptor(target, key) {
    const slot = getSlot(target, key)
    if (slot) {
      return {
        configurable: true,
        enumerable: true,
        value: slot,
      }
    }
  },
  ownKeys(target) {
    let keys = Object.keys(target)
    const dynamicSources = target.$
    if (dynamicSources) {
      keys = keys.filter(k => k !== '$')
      for (const source of dynamicSources) {
        if (isFunction(source)) {
          const slot = resolveFunctionSource(source)
          if (slot) {
            if (isArray(slot)) {
              for (let i = 0; i < slot.length; i++) {
                keys.push(String(slot[i].name))
              }
            } else {
              keys.push(String(slot.name))
            }
          }
        } else {
          keys.push(...Object.keys(source))
        }
      }
    }
    return keys
  },
  set: NO,
  deleteProperty: NO,
}

export function getSlot(target, key) {
  if (key === '$') return
  const dynamicSources = target.$
  if (dynamicSources) {
    let i = dynamicSources.length
    let source
    while (i--) {
      source = dynamicSources[i]
      if (isFunction(source)) {
        const slot = resolveFunctionSource(source)
        if (slot) {
          if (isArray(slot)) {
            for (let j = slot.length - 1; j >= 0; j--) {
              if (String(slot[j].name) === key) return slot[j].fn
            }
          } else if (String(slot.name) === key) {
            return slot.fn
          }
        }
      } else if (hasOwn(source, key)) {
        return source[key]
      }
    }
  }
  if (hasOwn(target, key)) {
    return target[key]
  }
}

/** 返回当前slotOwner或currentInstance
 * root组件， 返回null
 */
export function getScopeOwner() {
  return currentSlotOwner || currentInstance
}

export function withVaporCtx(fn) {
  const owner = getScopeOwner()
  return (...args) => {
    const prevOwner = setCurrentSlotOwner(owner)
    try {
      return fn(...args)
    } finally {
      setCurrentSlotOwner(prevOwner)
    }
  }
}

export function createSlot(name, rawProps, fallback, noSlotted, once) {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  resetInsertionState()

  const instance = getScopeOwner()
  const rawSlots = instance.rawSlots
  const slotProps = rawProps
    ? new Proxy(rawProps, rawPropsProxyHandlers)
    : EMPTY_OBJ
  const scopeId = !noSlotted && instance.type.__scopeId
  const slotScopeIds = scopeId ? [`${scopeId}-s`] : null

  const slotFragment = new SlotFragment()
  const fragment = slotFragment
  slotFragment.forwarded =
    currentSlotOwner != null && currentSlotOwner !== currentInstance
  const isDynamicName = isFunction(name)

  const renderSlot = () => {
    const slotName = isFunction(name) ? name() : name
    const slot = getSlot(rawSlots, slotName)
    if (slot) {
      slotFragment.updateSlot(getBoundSlot(slot), fallback)
    } else {
      slotFragment.updateSlot(undefined, fallback)
    }
  }

  let cachedSlot
  let cachedBoundSlot
  const getBoundSlot = slot => {
    if (slot !== cachedSlot) {
      cachedSlot = slot
      cachedBoundSlot = () => {
        const prev = inOnceSlot
        try {
          if (once) inOnceSlot = true
          return slot(slotProps)
        } finally {
          inOnceSlot = prev
        }
      }
    }
    return cachedBoundSlot
  }

  if (!once && (isDynamicName || rawSlots.$)) {
    renderEffect(renderSlot)
  } else {
    renderSlot()
  }

  if (slotScopeIds) {
    setScopeId(fragment, slotScopeIds)
  }

  if (_insertionParent) insert(fragment, _insertionParent, _insertionAnchor)

  return fragment
}
