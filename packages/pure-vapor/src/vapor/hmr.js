import { isArray } from '@vue/shared'
import {
  restoreCurrentInstance,
  setCurrentInstance,
} from '../internal/instance.js'
import { popWarningContext, pushWarningContext } from '../internal/warning.js'
import { insert, normalizeBlock, remove } from './block.js'
import {
  createComponent,
  devRender,
  isVaporComponent,
  mountComponent,
  unmountComponent,
} from './component.js'
import { isFragment } from './fragment.js'
import { isKeepAlive } from '../internal/keepAlive.js'
import { isKeepAliveEnabled } from './keepAlive.js'

export function hmrRerender(instance) {
  const normalized = normalizeBlock(instance.block)
  const parent = normalized[0].parentNode
  const anchor = normalized[normalized.length - 1].nextSibling
  instance.scope.reset()
  remove(instance.block, parent)
  const prev = setCurrentInstance(instance)
  pushWarningContext(instance)
  devRender(instance)
  popWarningContext()
  restoreCurrentInstance(prev)
  insert(instance.block, parent, anchor)
}

export function hmrReload(instance, newComp) {
  if (isKeepAliveEnabled && instance.parent && isKeepAlive(instance.parent)) {
    instance.parent.hmrRerender()
    return
  }
  const normalized = normalizeBlock(instance.block)
  const parent = normalized[0].parentNode
  const anchor = normalized[normalized.length - 1].nextSibling
  unmountComponent(instance, parent)
  const parentInstance = instance.parent
  const prev = setCurrentInstance(parentInstance)
  const newInstance = createComponent(
    newComp,
    instance.rawProps,
    instance.rawSlots,
    instance.isSingleRoot,
    undefined,
    instance.appContext,
  )
  restoreCurrentInstance(prev)
  mountComponent(newInstance, parent, anchor)

  updateParentBlockOnHmrReload(parentInstance, instance, newInstance)
  updateParentTeleportOnHmrReload(instance, newInstance)
}

function updateParentBlockOnHmrReload(parentInstance, instance, newInstance) {
  if (parentInstance) {
    parentInstance.block = replaceBlockInstance(
      parentInstance.block,
      instance,
      newInstance,
    )
  }
}

export function updateParentTeleportOnHmrReload(instance, newInstance) {
  const teleport = instance.parentTeleport
  if (teleport) {
    newInstance.parentTeleport = teleport
    teleport.nodes = replaceBlockInstance(teleport.nodes, instance, newInstance)
  }
}

function replaceBlockInstance(block, instance, newInstance) {
  if (block === instance) {
    return newInstance
  }

  if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      block[i] = replaceBlockInstance(block[i], instance, newInstance)
    }
    return block
  }

  if (isVaporComponent(block)) {
    block.block = replaceBlockInstance(block.block, instance, newInstance)
    return block
  }

  if (isFragment(block)) {
    block.nodes = replaceBlockInstance(block.nodes, instance, newInstance)
    return block
  }

  return block
}
