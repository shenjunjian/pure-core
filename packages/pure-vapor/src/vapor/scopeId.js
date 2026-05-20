import { isArray } from '@vue/shared'
import { isVaporComponent } from './component.js'
import { isFragment } from './fragment.js'

export function setScopeId(block, scopeIds) {
  if (block instanceof Element) {
    for (let i = 0; i < scopeIds.length; i++) {
      block.setAttribute(scopeIds[i], '')
    }
  } else if (isVaporComponent(block)) {
    setScopeId(block.block, scopeIds)
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      setScopeId(block[i], scopeIds)
    }
  } else if (isFragment(block)) {
    setScopeId(block.nodes, scopeIds)
  }
}

export function setComponentScopeId(instance) {
  const parent = instance.parent
  const scopeId = instance.scopeId
  if (!parent || !scopeId) return

  if (isArray(instance.block) && instance.block.length > 1) return

  const scopeIds = []
  const parentScopeId = parent && parent.type.__scopeId
  if (parentScopeId !== scopeId) {
    scopeIds.push(scopeId)
  } else {
    if (parentScopeId) scopeIds.push(parentScopeId)
  }

  if (scopeIds.length > 0) {
    setScopeId(instance.block, scopeIds)
  }
}
