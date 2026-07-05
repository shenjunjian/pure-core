import { isArray } from '@vue/shared'
import { getRootElement, isVaporComponent } from './component.js'
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
    trackScopeIdFragment(block, scopeIds, false)
    setScopeId(block.nodes, scopeIds)
  }
}

const trackedScopeIdFragments = new WeakMap()

export function trackScopeIdFragment(frag, scopeIds, recursive = true) {
  if (trackFragmentScopeIds(frag, scopeIds)) {
    if (!frag.onBeforeInsert) frag.onBeforeInsert = []
    frag.onBeforeInsert.push(nodes => setScopeId(nodes, scopeIds))
  }
  if (recursive) {
    trackScopeIdsInBlock(frag.nodes, scopeIds)
  }
}

function trackFragmentScopeIds(frag, scopeIds) {
  const key = scopeIds.join(' ')
  let trackedScopeIds = trackedScopeIdFragments.get(frag)
  if (!trackedScopeIds) {
    trackedScopeIds = new Set()
    trackedScopeIdFragments.set(frag, trackedScopeIds)
  } else if (trackedScopeIds.has(key)) {
    return false
  }
  trackedScopeIds.add(key)
  return true
}

function trackScopeIdsInBlock(block, scopeIds) {
  if (isVaporComponent(block)) {
    trackScopeIdsInBlock(block.block, scopeIds)
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      trackScopeIdsInBlock(block[i], scopeIds)
    }
  } else if (isFragment(block)) {
    trackScopeIdFragment(block, scopeIds)
  }
}

const trackedInheritedScopeIdFragments = new WeakMap()

function trackInheritedScopeIdFragment(instance, frag) {
  let trackedInstances = trackedInheritedScopeIdFragments.get(frag)
  if (!trackedInstances) {
    trackedInstances = new WeakSet()
    trackedInheritedScopeIdFragments.set(frag, trackedInstances)
  } else if (trackedInstances.has(instance)) {
    return
  }
  trackedInstances.add(instance)
  if (!frag.onUpdated) frag.onUpdated = []
  frag.onUpdated.push(() => applyInheritedScopeIdToRoot(instance))
}

function applyInheritedScopeIdToRoot(instance) {
  const scopeId = instance.scopeId
  if (!scopeId) return
  const root = getRootElement(instance, frag =>
    trackInheritedScopeIdFragment(instance, frag),
  )
  if (root) {
    root.setAttribute(scopeId, '')
  }
  return root
}

export function trackComponentScopeId(instance) {
  const parent = instance.parent
  const scopeId = instance.scopeId
  if (!parent || !scopeId) return
  getRootElement(instance, frag =>
    trackInheritedScopeIdFragment(instance, frag),
  )
}

export function setComponentScopeId(instance) {
  const parent = instance.parent
  const scopeId = instance.scopeId
  if (!parent || !scopeId) return
  applyInheritedScopeIdToRoot(instance)
}
