import { ShapeFlags, invokeArrayFns, isArray } from '@vue/shared'
import { getComponentName } from '../../internal/component.js'
import { isAsyncWrapper } from '../../internal/asyncComponent.js'
import { matches, resetShapeFlag } from '../../internal/keepAlive.js'
import { watch } from '../../internal/watch.js'
import {
  onBeforeUnmount,
  onMounted,
  onUpdated,
} from '../../internal/lifecycle.js'
import { invalidateMount, queuePostFlushCb } from '../../internal/scheduler.js'
import { currentInstance } from '../../internal/instance.js'
import { warn } from '../../internal/warning.js'
import { defineVaporComponent } from '../apiDefineComponent.js'
import { findBlockNode, insert, move, remove } from '../block.js'
import { MoveType } from '../../internal/transitionRuntime.js'
import { isVaporComponent } from '../component.js'
import { createElement } from '../dom/node.js'
import { unsetRef } from '../refCleanup.js'
import { isDynamicFragment, isFragment } from '../fragment.js'
import {
  currentCacheKey,
  setCurrentKeepAliveCtx,
  withKeepAliveEnabled,
} from '../keepAlive.js'

const VaporKeepAliveImpl = defineVaporComponent({
  name: 'VaporKeepAlive',
  __isKeepAlive: true,
  props: {
    include: [String, RegExp, Array],
    exclude: [String, RegExp, Array],
    max: [String, Number],
  },
  setup(props, { slots, expose }) {
    if (__E2E_TEST__) {
      expose({ getStorageContainer: () => storageContainer })
    }

    if (!slots.default) {
      return undefined
    }

    const keepAliveInstance = currentInstance
    const cache = new Map()
    const keys = new Set()
    const storageContainer = createElement('div')
    const keptAliveScopes = new Map()

    const resolveCacheKeyFromBlock = (block, branchKey) => {
      return block.$key ?? branchKey ?? block.type
    }

    let current

    keepAliveInstance.ctx = {
      getStorageContainer: () => storageContainer,
      getCachedComponent: (comp, key) => {
        const k =
          key != null ? key : currentCacheKey != null ? currentCacheKey : comp
        return cache.get(k)
      },
      activate: (instance, parentNode, anchor) => {
        current = instance
        activate(instance, parentNode, anchor)
      },
      deactivate: instance => {
        current = undefined
        deactivate(instance, storageContainer)
      },
    }

    const innerCacheBlock = (key, block, isCurrent) => {
      const max = props.max
      if (cache.has(key)) {
        if (isCurrent) {
          keys.delete(key)
          keys.add(key)
        }
      } else {
        keys.add(key)
        if (max && keys.size > parseInt(max, 10)) {
          pruneCacheEntry(keys.values().next().value)
        }
      }
      cache.set(key, block)
      if (isCurrent) current = block
    }

    const cacheBlock = (block = keepAliveInstance.block) => {
      const innerBlock = getInnerBlock(block)
      if (!innerBlock) return

      const branchKey =
        isDynamicFragment(block) && block.keyed ? block.current : undefined
      const cacheKey = resolveCacheKeyFromBlock(innerBlock, branchKey)
      if (!shouldCache(innerBlock, props)) {
        if (cache.has(cacheKey)) pruneCacheEntry(cacheKey)
        return
      }

      setShapeFlag(innerBlock, cache.has(cacheKey))
      const { currentBlock, currentKey } = getCurrentBlockState()
      innerCacheBlock(
        cacheKey,
        innerBlock,
        currentBlock === innerBlock || currentKey === cacheKey,
      )
    }

    const processShapeFlag = block => {
      const innerBlock = getInnerBlock(block)
      if (!innerBlock || !shouldCache(innerBlock, props)) return false
      const cacheKey = resolveCacheKeyFromBlock(innerBlock)
      setShapeFlag(innerBlock, cache.has(cacheKey))
      return cacheKey
    }

    const pruneCache = filter => {
      cache.forEach((cached, key) => {
        const name = getComponentName(
          isAsyncWrapper(cached)
            ? cached.type.__asyncResolved || {}
            : cached.type,
        )
        if (name && !filter(name)) {
          pruneCacheEntry(key)
        }
      })
    }

    const deleteScope = key => {
      const scope = keptAliveScopes.get(key)
      if (scope) {
        keptAliveScopes.delete(key)
        for (const entry of keptAliveScopes) {
          if (entry[1] === scope) {
            keptAliveScopes.delete(entry[0])
            break
          }
        }
      }
      return scope
    }

    const pruneCacheEntry = key => {
      const cached = cache.get(key)
      if (cached && (!current || cached !== current)) {
        unsetShapeFlag(cached)
        const pn = findBlockNode(cached).parentNode
        if (pn) remove(cached, pn)
      } else if (current) {
        unsetShapeFlag(current)
      }
      cache.delete(key)
      keys.delete(key)
      const scope = deleteScope(key)
      if (scope) scope.stop()
    }

    watch(
      () => [props.include, props.exclude],
      ([include, exclude]) => {
        if (include) pruneCache(name => matches(include, name))
        if (exclude) pruneCache(name => !matches(exclude, name))
      },
      { flush: 'post', deep: true },
    )

    onMounted(cacheBlock)
    onUpdated(cacheBlock)

    const getCurrentBlockState = () => {
      const block = keepAliveInstance.block
      const currentBlock = getInnerBlock(block)
      const branchKey =
        isDynamicFragment(block) && block.keyed
          ? block.current
          : currentCacheKey
      return {
        currentBlock,
        currentKey:
          currentBlock && resolveCacheKeyFromBlock(currentBlock, branchKey),
      }
    }

    onBeforeUnmount(() => {
      const { currentBlock, currentKey } = getCurrentBlockState()

      const deactivateCached = cached => {
        unsetShapeFlag(cached)
        if (cached.a) queuePostFlushCb(cached.a)
      }

      let matched = false
      cache.forEach((cached, key) => {
        if (currentKey === key) {
          matched = true
          deactivateCached(cached)
          return
        }
        unsetShapeFlag(cached)
        remove(cached, storageContainer)
      })

      if (!matched && currentBlock && isKeptAlive(currentBlock)) {
        deactivateCached(currentBlock)
      }

      for (const scope of keptAliveScopes.values()) {
        scope.stop()
      }
      keptAliveScopes.clear()
    })

    const keepAliveCtx = {
      processShapeFlag,
      cacheBlock,
      cacheScope(cacheKey, scopeLookupKey, scope) {
        const prevScope = keptAliveScopes.get(cacheKey)
        if (prevScope && prevScope !== scope) {
          const staleScope = deleteScope(cacheKey)
          if (staleScope) staleScope.stop()
        }
        keptAliveScopes.set(cacheKey, scope)
        if (scopeLookupKey !== cacheKey) {
          keptAliveScopes.set(scopeLookupKey, scope)
        }
      },
      getScope(key) {
        return deleteScope(key)
      },
    }

    const prevCtx = setCurrentKeepAliveCtx(keepAliveCtx)
    let children = slots.default()
    setCurrentKeepAliveCtx(prevCtx)

    if (isArray(children)) {
      children = children.filter(child => !(child instanceof Comment))
      if (children.length > 1) {
        if (__DEV__) {
          warn(`KeepAlive should contain exactly one component child.`)
        }
        return children
      }
    }

    return children
  },
})

export const VaporKeepAlive =
  /*@__PURE__*/ withKeepAliveEnabled(VaporKeepAliveImpl)

function shouldCache(block, props) {
  const isAsync = isAsyncWrapper(block)
  const type = block.type

  if (isAsync && !type.__asyncResolved) {
    return !props.include
  }

  const include = props.include
  const exclude = props.exclude
  const name = getComponentName(isAsync ? type.__asyncResolved : type)
  return !(
    (include && (!name || !matches(include, name))) ||
    (exclude && name && matches(exclude, name))
  )
}

function setShapeFlag(block, cached) {
  if (cached) {
    block.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE
  }
  block.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
}

function unsetShapeFlag(cached) {
  if (isVaporComponent(cached)) {
    resetShapeFlag(cached)
    if (isAsyncWrapper(cached)) {
      const inner = getInnerBlock(cached.block)
      if (inner && isVaporComponent(inner)) {
        resetShapeFlag(inner)
      }
    }
  }
}

function isKeptAlive(cached) {
  return !!(cached.shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE)
}

function getInnerBlock(block) {
  if (isVaporComponent(block)) {
    return block
  } else if (isFragment(block)) {
    return getInnerBlock(block.nodes)
  }
}

export function activate(instance, parentNode, anchor) {
  move(instance.block, parentNode, anchor, MoveType.ENTER, instance)
  queuePostFlushCb(() => {
    instance.isDeactivated = false
    if (instance.a) invokeArrayFns(instance.a)
  })
}

export function deactivate(instance, container) {
  unsetRef(instance)
  invalidateMount(instance.m)
  invalidateMount(instance.a)
  move(instance.block, container, null, MoveType.LEAVE, instance)
  queuePostFlushCb(() => {
    if (instance.da) invokeArrayFns(instance.da)
    instance.isDeactivated = true
  })
}
