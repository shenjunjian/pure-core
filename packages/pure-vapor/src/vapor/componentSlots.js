import {
  EMPTY_OBJ,
  NO,
  VaporSlotFlags,
  hasOwn,
  isArray,
  isFunction,
} from '@vue/shared'
import { insert } from './block.js'
import {
  rawPropsProxyHandlers,
  resolveFunctionSource,
  snapshotRawProps,
} from './componentProps.js'
import { currentInstance } from '../internal/instance.js'
import { isAsyncWrapper } from '../internal/asyncComponent.js'
import { renderEffect } from './renderEffect.js'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
} from './insertionState.js'
import { DynamicFragment, SlotFragment } from './fragment.js'
import { currentSlotBoundary, withSlotBoundary } from './slotBoundary.js'
import { createElement } from './dom/node.js'
import { setDynamicProps } from './dom/prop.js'
import { setScopeId } from './scopeId.js'

export let inOnceSlot = false

export function withOnceSlot(fn, value = true) {
  const prev = inOnceSlot
  try {
    inOnceSlot = value
    return fn()
  } finally {
    inOnceSlot = prev
  }
}

export let currentSlotScopeIds = null

function setCurrentSlotScopeIds(scopeIds) {
  try {
    return currentSlotScopeIds
  } finally {
    currentSlotScopeIds = scopeIds
  }
}

const rawSlotsOwnerMap = new WeakMap()
const rawSlotWrappersCache = new WeakMap()

export function getRawSlotsOwner(slots) {
  return rawSlotsOwnerMap.get(slots) || null
}

export function normalizeRawSlots(rawSlots) {
  if (!rawSlots) return rawSlots
  const normalized = isFunction(rawSlots) ? { default: rawSlots } : rawSlots
  if (!rawSlotsOwnerMap.has(normalized)) {
    rawSlotsOwnerMap.set(normalized, getScopeOwner())
  }
  return normalized
}

function withSlotOwner(slots, fn) {
  if (!rawSlotsOwnerMap.has(slots)) {
    return fn()
  }
  const prevOwner = setCurrentSlotOwner(rawSlotsOwnerMap.get(slots) || null)
  try {
    return fn()
  } finally {
    setCurrentSlotOwner(prevOwner)
  }
}

function getOwnedSlot(slots, key, slot) {
  if (!rawSlotsOwnerMap.has(slots)) {
    return slot
  }
  let wrappers = rawSlotWrappersCache.get(slots)
  if (!wrappers) {
    rawSlotWrappersCache.set(slots, (wrappers = new Map()))
  }
  const cached = wrappers.get(key)
  if (cached && cached.slot === slot) {
    return cached.wrapped
  }
  const wrapped = (...args) => withSlotOwner(slots, () => slot(...args))
  wrapped._ = slot._
  wrappers.set(key, { slot, wrapped })
  return wrapped
}

export let currentSlotOwner = null

export function setCurrentSlotOwner(owner) {
  try {
    return currentSlotOwner
  } finally {
    currentSlotOwner = owner
  }
}

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
    const keys = new Set(Object.keys(target).filter(k => k !== '$'))
    const dynamicSources = target.$
    if (dynamicSources) {
      for (const source of dynamicSources) {
        if (isFunction(source)) {
          const slot = withSlotOwner(target, () =>
            resolveFunctionSource(source),
          )
          if (slot) {
            if (isArray(slot)) {
              for (const s of slot) keys.add(String(s.name))
            } else {
              keys.add(String(slot.name))
            }
          }
        } else {
          for (const key of Object.keys(source)) keys.add(key)
        }
      }
    }
    return [...keys]
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
        const slot = withSlotOwner(target, () => resolveFunctionSource(source))
        if (slot) {
          if (isArray(slot)) {
            for (let j = slot.length - 1; j >= 0; j--) {
              if (String(slot[j].name) === key) {
                return getOwnedSlot(target, key, slot[j].fn)
              }
            }
          } else if (String(slot.name) === key) {
            return getOwnedSlot(target, key, slot.fn)
          }
        }
      } else if (hasOwn(source, key)) {
        return getOwnedSlot(target, key, source[key])
      }
    }
  }
  if (hasOwn(target, key)) {
    return getOwnedSlot(target, key, target[key])
  }
}

export function createSlot(name = 'default', rawProps, fallback, flags = 0) {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  resetInsertionState()

  const instance = getScopeOwner()
  const rawSlots = instance.rawSlots
  const scopeId =
    !(flags & VaporSlotFlags.NO_SLOTTED) && instance.type.__scopeId
  const slotScopeIds = scopeId ? [`${scopeId}-s`] : null
  const once = !!(flags & VaporSlotFlags.ONCE)
  const slotRoot = !!(flags & VaporSlotFlags.SLOT_ROOT)
  const slotProps = rawProps
    ? new Proxy(
        once ? snapshotRawProps(rawProps) : rawProps,
        rawPropsProxyHandlers,
      )
    : EMPTY_OBJ
  if (once && fallback) {
    const originalFallback = fallback
    fallback = (...args) => withOnceSlot(() => originalFallback(...args))
  }

  const isCustomElementSlot = !!(
    instance.ce ||
    (instance.parent && isAsyncWrapper(instance.parent) && instance.parent.ce)
  )
  const needsSlotFragment = shouldUseSlotFragment(
    rawSlots,
    name,
    fallback,
    isCustomElementSlot,
  )
  const slotFragment = needsSlotFragment
    ? new SlotFragment(slotRoot)
    : undefined
  let dynamicFragment
  let fragment
  if (slotFragment) {
    fragment = slotFragment
  } else {
    dynamicFragment = new DynamicFragment(
      __DEV__ ? 'slot' : undefined,
      false,
      false,
    )
    dynamicFragment.isSlot = true
    fragment = dynamicFragment
  }

  fragment.forwarded =
    currentSlotOwner != null && currentSlotOwner !== currentInstance

  const isDynamicName = isFunction(name)

  const renderSlot = () => {
    const slotName = isFunction(name) ? name() : name

    if (isCustomElementSlot) {
      const el = createElement('slot')
      const setSlotProps = () => {
        setDynamicProps(el, [
          slotProps,
          slotName !== 'default' ? { name: slotName } : {},
        ])
      }
      if (once) setSlotProps()
      else renderEffect(setSlotProps)
      if (fallback) {
        withSlotBoundary(slotFragment.slotBoundary, () => {
          const fallbackBlock = fallback()
          slotFragment.customElementFallback = fallbackBlock
          insert(fallbackBlock, el)
        })
      }
      fragment.nodes = el
      return
    }

    const slot = getSlot(rawSlots, slotName)
    const render = slot ? getBoundSlot(slot) : undefined
    if (slotFragment) {
      slotFragment.updateSlot(render, fallback)
    } else {
      dynamicFragment.update(render || fallback)
    }
  }

  let cachedSlot
  let cachedBoundSlot
  const getBoundSlot = slot => {
    if (slot !== cachedSlot) {
      cachedSlot = slot
      cachedBoundSlot = () => {
        const prevSlotScopeIds = setCurrentSlotScopeIds(slotScopeIds)
        try {
          return once ? withOnceSlot(() => slot(slotProps)) : slot(slotProps)
        } finally {
          setCurrentSlotScopeIds(prevSlotScopeIds)
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

function shouldUseSlotFragment(rawSlots, name, fallback, isCustomElementSlot) {
  if (isCustomElementSlot) return true
  if (currentSlotBoundary) return true
  if (!fallback) return false
  if (rawSlots === EMPTY_OBJ) return false
  if (isFunction(name) || rawSlots.$) return true
  const slot = getSlot(rawSlots, name)
  if (!slot) return false
  return slot._ === VaporSlotFlags.NON_STABLE
}
