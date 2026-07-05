import {
  EffectScope,
  isReactive,
  isReadonly,
  isShallow,
  onScopeDispose,
  setActiveSub,
  shallowReadArray,
  shallowRef,
  toReactive,
  toReadonly,
  watch,
} from '@vue/reactivity'
import { isArray, isObject, isString, VaporVForFlags } from '@vue/shared'
import { createComment, createTextNode } from './dom/node.js'
import { insert, remove } from './block.js'
import { queuePostFlushCb, warn } from '../internal/index.js'
import { currentInstance } from '../internal/instance.js'
import { isVaporComponent } from './component.js'
import { currentSlotOwner, setCurrentSlotOwner } from './componentSlots.js'
import { renderEffect } from './renderEffect.js'
import { ForBlock, ForFragment } from './fragment.js'
import { setBlockKey } from './helpers/setKey.js'
import { applyTransitionHooks, isTransitionEnabled } from './transition.js'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
} from './insertionState.js'
import { domAppendChild, domSetTextContent } from './dom/domOps.js'

export function createFor(src, renderItem, getKey, flags = 0) {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  resetInsertionState()

  let isMounted = false
  let oldBlocks = []
  let newBlocks
  let newKeys
  let parent
  let parentAnchor = __DEV__ ? createComment('for') : createTextNode()

  const trackSlotBoundary = !!(flags & VaporVForFlags.SLOT_ROOT)
  const frag = new ForFragment(
    oldBlocks,
    trackSlotBoundary,
    trackSlotBoundary
      ? () => {
          const parent = parentAnchor.parentNode
          if (parent) remove(parentAnchor, parent)
        }
      : undefined,
  )
  const instance = currentInstance
  const isComponent = !!(flags & VaporVForFlags.IS_COMPONENT)
  const canUseFastRemove =
    !!(flags & VaporVForFlags.FAST_REMOVE) && !isComponent
  const isSingleNode = !!(flags & VaporVForFlags.IS_SINGLE_NODE)
  const isFragment = !!(flags & VaporVForFlags.IS_FRAGMENT)
  const slotOwner = currentSlotOwner

  if (__DEV__ && !instance) {
    warn('createFor() can only be used inside setup()')
  }

  if (!isComponent) {
    onScopeDispose(() => {
      stopBlockScopes(oldBlocks)
      if (newBlocks && newBlocks !== oldBlocks) {
        stopBlockScopes(newBlocks)
      }
      oldBlocks = []
      newBlocks = []
    }, true)
  }

  const renderList = () => {
    const source = normalizeSource(src())
    const newLength = source.values.length
    const oldLength = oldBlocks.length
    newBlocks = new Array(newLength)
    newKeys = undefined
    if (getKey) {
      newKeys = new Array(newLength)
      for (let i = 0; i < newLength; i++) {
        newKeys[i] = getKey(...getItem(source, i))
      }
    }

    const prevSub = setActiveSub()
    const wasMounted = isMounted
    if (wasMounted && frag.onBeforeUpdate) {
      for (let i = 0; i < frag.onBeforeUpdate.length; i++) {
        frag.onBeforeUpdate[i]()
      }
    }
    if (!wasMounted) {
      isMounted = true
      for (let i = 0; i < newLength; i++) {
        mount(source, i)
      }
    } else {
      parent = parentAnchor.parentNode
      if (!oldLength) {
        for (let i = 0; i < newLength; i++) {
          mount(source, i)
        }
      } else if (!newLength) {
        if (frag.resetListeners) {
          for (let i = 0; i < frag.resetListeners.length; i++) {
            frag.resetListeners[i]()
          }
        }
        const doRemove = !canUseFastRemove
        for (let i = 0; i < oldLength; i++) {
          unmount(oldBlocks[i], doRemove)
        }
        if (canUseFastRemove) {
          domSetTextContent(parent, '')
          domAppendChild(parent, parentAnchor)
        }
      } else if (!getKey) {
        const commonLength = Math.min(newLength, oldLength)
        for (let i = 0; i < commonLength; i++) {
          update((newBlocks[i] = oldBlocks[i]), getItem(source, i)[0])
        }
        for (let i = oldLength; i < newLength; i++) {
          mount(source, i)
        }
        for (let i = newLength; i < oldLength; i++) {
          unmount(oldBlocks[i])
        }
      } else {
        keyedPatch(source, newLength, oldLength, newKeys)
      }
    }

    frag.nodes = [(oldBlocks = newBlocks)]
    if (parentAnchor) frag.nodes.push(parentAnchor)

    if (wasMounted && frag.onUpdated) {
      for (let i = 0; i < frag.onUpdated.length; i++) {
        frag.onUpdated[i]()
      }
    }
    setActiveSub(prevSub)
  }

  const keyedPatch = (source, newLength, oldLength, newKeys) => {
    const commonLength = Math.min(oldLength, newLength)
    const oldKeyIndexPairs = new Array(oldLength)
    const queuedBlocks = new Array(newLength)

    let endOffset = 0
    let queuedBlocksLength = 0
    let oldKeyIndexPairsLength = 0

    while (endOffset < commonLength) {
      const index = newLength - endOffset - 1
      const item = getItem(source, index)
      const key = newKeys[index]
      const existingBlock = oldBlocks[oldLength - endOffset - 1]
      if (existingBlock.key !== key) break
      update(existingBlock, ...item)
      newBlocks[index] = existingBlock
      endOffset++
    }

    const e1 = commonLength - endOffset
    const e2 = oldLength - endOffset
    const e3 = newLength - endOffset

    for (let i = 0; i < e1; i++) {
      const currentItem = getItem(source, i)
      const currentKey = newKeys[i]
      const oldBlock = oldBlocks[i]
      if (oldBlock.key === currentKey) {
        update((newBlocks[i] = oldBlock), currentItem[0])
      } else {
        queuedBlocks[queuedBlocksLength++] = [i, currentItem, currentKey]
        oldKeyIndexPairs[oldKeyIndexPairsLength++] = [oldBlock.key, i]
      }
    }

    for (let i = e1; i < e2; i++) {
      oldKeyIndexPairs[oldKeyIndexPairsLength++] = [oldBlocks[i].key, i]
    }

    for (let i = e1; i < e3; i++) {
      const blockItem = getItem(source, i)
      queuedBlocks[queuedBlocksLength++] = [i, blockItem, newKeys[i]]
    }

    queuedBlocks.length = queuedBlocksLength
    oldKeyIndexPairs.length = oldKeyIndexPairsLength

    const oldKeyIndexMap = new Map(oldKeyIndexPairs)
    const opers = new Array(queuedBlocks.length)

    let mountCounter = 0
    let opersLength = 0

    for (let i = queuedBlocks.length - 1; i >= 0; i--) {
      const [index, item, key] = queuedBlocks[i]
      const oldIndex = oldKeyIndexMap.get(key)
      if (oldIndex !== undefined) {
        oldKeyIndexMap.delete(key)
        const reusedBlock = (newBlocks[index] = oldBlocks[oldIndex])
        update(reusedBlock, ...item)
        opers[opersLength++] = { index, block: reusedBlock }
      } else {
        mountCounter++
        opers[opersLength++] = { source, index, item, key }
      }
    }

    const useFastRemove = mountCounter === newLength

    if (useFastRemove && frag.resetListeners) {
      for (let i = 0; i < frag.resetListeners.length; i++) {
        frag.resetListeners[i]()
      }
    }
    for (const leftoverIndex of oldKeyIndexMap.values()) {
      unmount(oldBlocks[leftoverIndex], !(useFastRemove && canUseFastRemove))
    }
    if (useFastRemove && canUseFastRemove) {
      domSetTextContent(parent, '')
      domAppendChild(parent, parentAnchor)
    }

    if (opers.length === mountCounter) {
      for (let i = 0; i < opers.length; i++) {
        const oper = opers[i]
        if (oper.source) {
          mount(
            oper.source,
            oper.index,
            oper.index < newLength - 1
              ? normalizeAnchor(newBlocks[oper.index + 1].nodes)
              : parentAnchor,
            oper.item,
            oper.key,
          )
        }
      }
    } else if (opers.length) {
      let anchor = oldBlocks[0]
      let blocksTail
      for (let i = 0; i < oldLength; i++) {
        const block = oldBlocks[i]
        if (oldKeyIndexMap.has(block.key)) {
          continue
        }
        block.prevAnchor = anchor
        anchor = oldBlocks[i + 1]
        if (blocksTail !== undefined) {
          blocksTail.next = block
          block.prev = blocksTail
        }
        blocksTail = block
      }
      for (let i = 0; i < opers.length; i++) {
        const action = opers[i]
        const index = action.index
        if (index < newLength - 1) {
          const nextBlock = newBlocks[index + 1]
          let anchorNode = normalizeAnchor(nextBlock.prevAnchor.nodes)
          if (!anchorNode.parentNode) {
            anchorNode = normalizeAnchor(nextBlock.nodes)
          }
          if (action.source) {
            const block = mount(
              action.source,
              index,
              anchorNode,
              action.item,
              action.key,
            )
            moveLink(block, nextBlock.prev, nextBlock)
          } else if (action.block.next !== nextBlock) {
            insertForBlock(action.block, anchorNode)
            moveLink(action.block, nextBlock.prev, nextBlock)
          }
        } else if (action.source) {
          const block = mount(
            action.source,
            index,
            parentAnchor,
            action.item,
            action.key,
          )
          moveLink(block, blocksTail)
          blocksTail = block
        } else if (action.block.next !== undefined) {
          let anchorNode = anchor ? normalizeAnchor(anchor.nodes) : parentAnchor
          if (!anchorNode.parentNode) anchorNode = parentAnchor
          insertForBlock(action.block, anchorNode)
          moveLink(action.block, blocksTail)
          blocksTail = action.block
        }
      }
      for (let i = 0; i < newBlocks.length; i++) {
        const block = newBlocks[i]
        block.prevAnchor = block.next = block.prev = undefined
      }
    }
  }

  const needKey = renderItem.length > 1
  const needIndex = renderItem.length > 2

  const insertForBlock = isSingleNode
    ? (block, anchor) => insert(block.nodes, parent, anchor)
    : isFragment
      ? (block, anchor) => insert(block.nodes, parent, anchor)
      : (block, anchor) => insert(block.nodes, parent, anchor)

  const removeForBlock = block => remove(block.nodes, parent)

  const mount = (
    source,
    idx,
    anchor = parentAnchor,
    itemTuple = getItem(source, idx),
    key2 = newKeys ? newKeys[idx] : getKey && getKey(...itemTuple),
  ) => {
    const item = itemTuple[0]
    const key = itemTuple[1]
    const index = itemTuple[2]
    const itemRef = shallowRef(item)
    const keyRef = needKey ? shallowRef(key) : undefined
    const indexRef = needIndex ? shallowRef(index) : undefined

    let nodes
    let scope
    if (isComponent) {
      nodes = renderItem(itemRef, keyRef, indexRef)
    } else {
      scope = new EffectScope(true)
      try {
        nodes = scope.run(() => renderItem(itemRef, keyRef, indexRef))
      } catch (err) {
        scope.stop()
        throw err
      }
    }

    const block = (newBlocks[idx] = new ForBlock(
      nodes,
      scope,
      itemRef,
      keyRef,
      indexRef,
      key2,
    ))

    if (isTransitionEnabled && frag.$transition) {
      if (frag.$transition.applyGroup) setBlockKey(block.nodes, block.key)
      applyTransitionHooks(block.nodes, frag.$transition)
    }

    if (parent) {
      const onBeforeInsert = frag.onBeforeInsert
      if (onBeforeInsert) {
        for (let i = 0; i < onBeforeInsert.length; i++) {
          onBeforeInsert[i](block.nodes)
        }
      }
      insertForBlock(block, anchor)
    }
    return block
  }

  const update = (block, newItem, newKey, newIndex) => {
    if (newItem !== block.itemRef.value) {
      block.itemRef.value = newItem
    }
    if (block.keyRef && newKey !== undefined && newKey !== block.keyRef.value) {
      block.keyRef.value = newKey
    }
    if (
      block.indexRef &&
      newIndex !== undefined &&
      newIndex !== block.indexRef.value
    ) {
      block.indexRef.value = newIndex
    }
  }

  const unmount = (block, doRemove = true) => {
    if (!isComponent) {
      block.scope.stop()
    }
    if (doRemove) {
      removeForBlock(block)
    }
  }

  if (flags & VaporVForFlags.ONCE) {
    renderList()
  } else {
    renderEffect(() => {
      if (!isMounted) return renderList()
      const prevOwner = setCurrentSlotOwner(slotOwner)
      try {
        renderList()
      } finally {
        setCurrentSlotOwner(prevOwner)
      }
    })
  }

  if (_insertionParent) insert(frag, _insertionParent, _insertionAnchor)
  return frag
}

export function createSelector(source) {
  const operMap = new Map()
  let activeKey = source()
  let activeOpers
  let pendingKey = activeKey
  let pending = false
  let generation = 0

  watch(source, newValue => {
    pendingKey = newValue
    if (pending) return
    pending = true

    if (activeOpers !== undefined) {
      for (let i = 0; i < activeOpers.length; i++) {
        activeOpers[i]()
      }
    }

    queuePostFlushCb(() => {
      pending = false
      activeKey = pendingKey
      activeOpers = operMap.get(activeKey)
      if (activeOpers !== undefined) {
        for (let i = 0; i < activeOpers.length; i++) {
          activeOpers[i]()
        }
      }
    })
  })

  const register = (key, oper) => {
    oper()
    let opers = operMap.get(key)
    if (opers !== undefined) {
      opers.push(oper)
    } else {
      opers = [oper]
      operMap.set(key, opers)
      if (key === activeKey) {
        activeOpers = opers
      }
    }
    const myGen = generation
    onScopeDispose(() => {
      if (myGen !== generation) return
      const list = operMap.get(key)
      if (list === undefined) return
      if (list.length === 1) {
        operMap.delete(key)
        if (key === activeKey) activeOpers = undefined
      } else {
        const idx = list.indexOf(oper)
        if (idx !== -1) list.splice(idx, 1)
      }
    }, true)
  }
  register.reset = () => {
    operMap.clear()
    activeOpers = undefined
    generation++
  }
  return register
}

function moveLink(block, newPrev, newNext) {
  const oldPrev = block.prev
  const oldNext = block.next
  if (oldPrev) oldPrev.next = oldNext
  if (oldNext) {
    oldNext.prev = oldPrev
    if (block.prevAnchor !== block) {
      oldNext.prevAnchor = block.prevAnchor
    }
  }
  if (newPrev) newPrev.next = block
  if (newNext) newNext.prev = block
  block.prev = newPrev
  block.next = newNext
  block.prevAnchor = block
}

function stopBlockScopes(blocks) {
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (block && block.scope) {
      block.scope.stop()
    }
  }
}

export function createForSlots(rawSource, getSlot) {
  const source = normalizeSource(rawSource)
  const sourceLength = source.values.length
  const slots = new Array(sourceLength)
  for (let i = 0; i < sourceLength; i++) {
    slots[i] = getSlot(...getItem(source, i))
  }
  return slots
}

function normalizeSource(source) {
  let values = source
  let needsWrap = false
  let isReadonlySource = false
  let keys
  if (isArray(source)) {
    if (isReactive(source)) {
      needsWrap = !isShallow(source)
      values = shallowReadArray(source)
      isReadonlySource = isReadonly(source)
    }
  } else if (isString(source)) {
    values = source.split('')
  } else if (typeof source === 'number') {
    if (__DEV__ && !Number.isInteger(source)) {
      warn(`The v-for range expect an integer value but got ${source}.`)
    }
    values = new Array(source)
    for (let i = 0; i < source; i++) values[i] = i + 1
  } else if (isObject(source)) {
    if (source[Symbol.iterator]) {
      values = Array.from(source)
    } else {
      keys = Object.keys(source)
      values = new Array(keys.length)
      for (let i = 0, l = keys.length; i < l; i++) {
        values[i] = source[keys[i]]
      }
    }
  } else {
    values = []
  }
  return { values, needsWrap, isReadonlySource, keys }
}

function getItem({ keys, values, needsWrap, isReadonlySource }, idx) {
  const value = needsWrap
    ? isReadonlySource
      ? toReadonly(toReactive(values[idx]))
      : toReactive(values[idx])
    : values[idx]
  if (keys) {
    return [value, keys[idx], idx]
  }
  return [value, idx, undefined]
}

function normalizeAnchor(node) {
  if (node instanceof Node) {
    return node
  } else if (isArray(node)) {
    return normalizeAnchor(node[0])
  } else if (isVaporComponent(node)) {
    return normalizeAnchor(node.block)
  }
  return normalizeAnchor(node.nodes)
}

export function getRestElement(val, keys) {
  const res = {}
  for (const key in val) {
    if (keys.indexOf(key) === -1) res[key] = val[key]
  }
  return res
}

export function getDefaultValue(val, defaultVal) {
  return val === undefined ? defaultVal : val
}

export function isForBlock(block) {
  return block instanceof ForBlock
}
