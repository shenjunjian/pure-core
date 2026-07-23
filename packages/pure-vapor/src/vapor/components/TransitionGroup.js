import { extend, isArray } from '@vue/shared'
import { EffectFlags, ReactiveEffect } from '@vue/reactivity'
import {
  resolveTransitionProps,
  TransitionPropsValidators,
} from '../../internal/transitionDom.js'
import {
  baseApplyTranslation,
  callPendingCbs,
  handleMovedChildren,
  hasCSSTransform,
} from '../../internal/transitionGroupDom.js'
import { useTransitionState } from '../../internal/baseTransition.js'
import { onBeforeUpdate, onUpdated } from '../../internal/lifecycle.js'
import { queuePostFlushCb } from '../../internal/scheduler.js'
import {
  currentInstance,
  restoreCurrentInstance,
  setCurrentInstance,
} from '../../internal/instance.js'
import { vShowHidden } from '../../internal/vShow.js'
import { forceReflow } from '../../internal/transitionDom.js'
import { warn } from '../../internal/warning.js'
import { insert } from '../block.js'
import { renderEffect } from '../renderEffect.js'
import { createElement } from '../dom/node.js'
import {
  DynamicFragment,
  isForBlock,
  isFragment,
  isSlotFragment,
} from '../fragment.js'
import { defineVaporComponent } from '../apiDefineComponent.js'
import { resolveDynamicProps } from '../componentProps.js'
import { isVaporComponent } from '../component.js'
import { isTransitionEnabled, registerTransitionHooks } from '../transition.js'
import {
  applyTransitionHooksImpl,
  getTransitionElement,
  isValidTransitionBlock,
  resolveTransitionHooks,
  setTransitionType,
} from './Transition.js'

const positionMap = new WeakMap()
const newPositionMap = new WeakMap()

const transitionGroupUpdateOwnerMap = new WeakMap()

const inheritedTransitionKeyMap = new WeakMap()
let transitionKeyGeneration = 0
let currentTransitionKeyGeneration = 0

const decorate = t => {
  delete t.props.mode
  return t
}

const VaporTransitionGroupImpl = /*@__PURE__*/ defineVaporComponent({
  name: 'VaporTransitionGroup',

  props: extend({}, TransitionPropsValidators, {
    tag: String,
    moveClass: String,
  }),

  setup(props, { slots, expose }) {
    expose()

    if (!isTransitionEnabled) {
      registerTransitionHooks(
        applyTransitionHooksImpl,
        () => false,
        () => false,
      )
    }

    const instance = currentInstance
    const state = useTransitionState()

    let cssTransitionProps
    const propsProxy = new Proxy(
      {},
      {
        get(_, key) {
          return cssTransitionProps[key]
        },
      },
    )

    renderEffect(
      () => (cssTransitionProps = resolveTransitionProps(props)),
      true,
    )

    let prevChildren = []
    let isUpdatePending = false
    let isUpdatedPending = false
    let slottedBlock = []

    const beforeUpdate = () => {
      if (isUpdatePending) return
      isUpdatePending = true
      prevChildren = []
      const children = resolveTransitionBlocks(slottedBlock)
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        const el =
          isValidTransitionBlock(child) && child.$transition
            ? getTransitionElement(child)
            : undefined
        if (el && !el[vShowHidden]) {
          prevChildren.push(child)
          child.$transition.disabled = true
          positionMap.set(child, el.getBoundingClientRect())
        }
      }
    }

    const flushUpdated = () => {
      isUpdatedPending = false
      if (!isUpdatePending) return
      isUpdatePending = false
      if (!prevChildren.length) return

      const moveClass = props.moveClass || `${props.name || 'v'}-move`
      const firstChild = getFirstConnectedChild(prevChildren)
      const hasMove = !!(
        firstChild &&
        hasCSSTransform(firstChild, firstChild.parentNode, moveClass)
      )
      prevChildren.forEach(child => {
        child.$transition.disabled = false
        if (hasMove) callPendingCbs(child)
      })
      if (!hasMove) {
        prevChildren = []
        return
      }

      prevChildren.forEach(recordPosition)
      const movedChildren = prevChildren.filter(applyTranslation)

      forceReflow()

      movedChildren.forEach(c =>
        handleMovedChildren(getTransitionElement(c), moveClass),
      )
      prevChildren = []
    }

    const updated = () => {
      if (!isUpdatePending || isUpdatedPending) return
      isUpdatedPending = true
      queuePostFlushCb(flushUpdated)
    }

    onBeforeUpdate(beforeUpdate)
    onUpdated(updated)

    const frag = new DynamicFragment('transition-group')
    let currentTag
    let currentSlot
    let isMounted = false

    renderEffect(() => {
      const tag = props.tag
      const slot = slots.default
      if (isMounted && tag === currentTag && slot === currentSlot) return

      const container = tag ? createElement(tag) : undefined
      let block = slottedBlock
      frag.update(() => {
        block = (slot && slot()) || []
        applyGroupTransitionHooks(block, propsProxy, state, instance, {
          beforeUpdate,
          updated,
        })
        if (container) {
          insert(block, container)
          return container
        }
        return block
      })
      slottedBlock = block

      currentTag = tag
      currentSlot = slot
      isMounted = true
    })
    return frag
  },
})

export const VaporTransitionGroup =
  /*@__PURE__*/ decorate(VaporTransitionGroupImpl)

export function resolveTransitionBlocks(block, onFragment, onUpdateOwner) {
  const children = []
  const prevGeneration = currentTransitionKeyGeneration
  currentTransitionKeyGeneration = ++transitionKeyGeneration
  try {
    collectTransitionBlocks(block, children, onFragment, onUpdateOwner)
    return children
  } finally {
    currentTransitionKeyGeneration = prevGeneration
  }
}

function collectTransitionBlocks(block, children, onFragment, onUpdateOwner) {
  if (block instanceof Node) {
    if (block instanceof Element) children.push(block)
  } else if (isVaporComponent(block)) {
    const isRootSlot = block.block && isSlotFragment(block.block)
    if (onUpdateOwner && !isRootSlot) onUpdateOwner(block)

    const start = children.length
    collectTransitionBlocks(
      block.block,
      children,
      onFragment,
      isRootSlot ? onUpdateOwner : undefined,
    )
    if (!isRootSlot) {
      for (let i = start; i < children.length; i++) {
        setTransitionType(children[i], block.type)
      }
    }
    inheritTransitionKey(children, start, block.$key)
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      collectTransitionBlocks(block[i], children, onFragment, onUpdateOwner)
    }
  } else if (isFragment(block)) {
    if (onFragment) onFragment(block)
    if (onUpdateOwner) onUpdateOwner(block)
    const start = children.length
    collectTransitionBlocks(block.nodes, children, onFragment, onUpdateOwner)
    if (isForBlock(block)) {
      const count = children.length - start
      for (let i = start; i < children.length; i++) {
        children[i].$key =
          block.key != null && count > 1
            ? `${block.key}:${i - start}`
            : block.key
      }
    } else {
      inheritTransitionKey(children, start, block.$key)
    }
  }
}

function inheritTransitionKey(children, start, key) {
  if (key == null || start === children.length) return
  for (let i = start; i < children.length; i++) {
    const child = children[i]
    let record = inheritedTransitionKeyMap.get(child)
    let baseKey
    if (record && record.generation === currentTransitionKeyGeneration) {
      baseKey = child.$key != null ? child.$key : i - start
    } else {
      if (!record || !Object.is(child.$key, record.inheritedKey)) {
        record = {
          generation: currentTransitionKeyGeneration,
          rawBaseKey: child.$key != null ? child.$key : i - start,
          inheritedKey: '',
        }
        inheritedTransitionKeyMap.set(child, record)
      } else {
        record.generation = currentTransitionKeyGeneration
      }
      baseKey = record.rawBaseKey
    }
    record.inheritedKey = String(key) + String(baseKey)
    child.$key = record.inheritedKey
  }
}

function applyGroupTransitionHooks(block, props, state, instance, updateHooks) {
  const fragments = []
  const children = resolveTransitionBlocks(
    block,
    frag => fragments.push(frag),
    owner => trackTransitionGroupUpdate(owner, updateHooks),
  )
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (isValidTransitionBlock(child)) {
      if (child.$key != null) {
        child.$transition = resolveTransitionHooks(
          child,
          props,
          state,
          instance,
        )
      } else if (__DEV__) {
        warn(`<transition-group> children must be keyed`)
      }
    }
  }

  fragments.forEach(frag => {
    const hooks = resolveTransitionHooks(frag, props, state, instance)
    hooks.applyGroup = (b, p, s, i) =>
      applyGroupTransitionHooks(b, p, s, i, updateHooks)
    frag.$transition = hooks
  })
  return children
}

function trackTransitionGroupUpdate(owner, updateHooks) {
  const registeredHooks = transitionGroupUpdateOwnerMap.get(owner)
  if (registeredHooks) {
    registeredHooks.beforeUpdate = updateHooks.beforeUpdate
    registeredHooks.updated = updateHooks.updated
    return
  }

  transitionGroupUpdateOwnerMap.set(owner, updateHooks)
  if (isFragment(owner)) {
    ;(owner.onBeforeUpdate || (owner.onBeforeUpdate = [])).push(() =>
      updateHooks.beforeUpdate(),
    )
    ;(owner.onUpdated || (owner.onUpdated = [])).push(() =>
      updateHooks.updated(),
    )
  } else {
    let isPending = false
    const flushUpdated = () => {
      isPending = false
      updateHooks.updated()
    }
    owner.scope.run(() => {
      const effect = new ReactiveEffect(() => {
        const prev = setCurrentInstance(owner, owner.scope)
        try {
          resolveDynamicProps(owner.rawProps)
        } finally {
          restoreCurrentInstance(prev)
        }
      })
      effect.notify = () => {
        if (effect.flags & EffectFlags.PAUSED || !effect.dirty) return
        effect.run()
        if (isPending) return
        isPending = true
        updateHooks.beforeUpdate()
        queuePostFlushCb(flushUpdated)
      }
      effect.run()
    })
  }
}

function recordPosition(c) {
  const el = getTransitionElement(c)
  if (el) newPositionMap.set(c, el.getBoundingClientRect())
}

function applyTranslation(c) {
  const el = getTransitionElement(c)
  if (
    el &&
    baseApplyTranslation(positionMap.get(c), newPositionMap.get(c), el)
  ) {
    return c
  }
}

function getFirstConnectedChild(children) {
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const el = getTransitionElement(child)
    if (el && el.isConnected) return el
  }
}
