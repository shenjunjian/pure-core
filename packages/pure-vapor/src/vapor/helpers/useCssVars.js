import { pauseTracking, resetTracking } from '@vue/reactivity'
import { isArray } from '@vue/shared'
import { currentInstance } from '../../internal/instance.js'
import { baseUseCssVars, setVarsOnNode } from '../../internal/useCssVarsBase.js'
import { isVaporComponent } from '../component.js'
import { isTeleportEnabled, isTeleportFragment } from '../teleport.js'

export function useVaporCssVars(getter) {
  if (!__BROWSER__ && !__TEST__) return
  const instance = currentInstance
  baseUseCssVars(
    instance,
    () => resolveParentNode(instance.block),
    getter,
    vars => setVars(instance, vars),
  )
}

function resolveParentNode(block) {
  if (block instanceof Node) {
    return block.parentNode
  } else if (isArray(block)) {
    return resolveParentNode(block[block.length - 1])
  } else if (isVaporComponent(block)) {
    return resolveParentNode(block.block)
  } else {
    return resolveParentNode(block.anchor || block.nodes)
  }
}

function setVars(instance, vars) {
  if (instance.ce) {
    setVarsOnNode(instance.ce, vars)
  } else {
    setVarsOnBlock(instance.block, vars)
  }
}

function setVarsOnBlock(block, vars) {
  if (block instanceof Node) {
    setVarsOnNode(block, vars)
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      setVarsOnBlock(block[i], vars)
    }
  } else if (isVaporComponent(block)) {
    setVarsOnBlock(block.block, vars)
  } else if (isTeleportEnabled && isTeleportFragment(block)) {
    return
  } else {
    setVarsOnBlock(block.nodes, vars)
  }
}

export function updateTeleportCssVars(frag) {
  const ctx = frag.scopeOwner
  if (ctx && ctx.ut) {
    let node
    let anchor
    const location = frag.mountState && frag.mountState.location
    if (location === 1) {
      node = frag.placeholder
      anchor = frag.anchor
    } else if (location === 2) {
      node = frag.targetStart
      anchor = frag.targetAnchor
    } else if (frag.isDisabled) {
      node = frag.placeholder
      anchor = frag.anchor
    } else {
      node = frag.targetStart
      anchor = frag.targetAnchor
    }
    if (!node || !anchor) return
    while (node && node !== anchor) {
      if (node.nodeType === 1)
        node.setAttribute('data-v-owner', String(ctx.uid))
      node = node.nextSibling
    }
    pauseTracking()
    try {
      ctx.ut()
    } finally {
      resetTracking()
    }
  }
}
