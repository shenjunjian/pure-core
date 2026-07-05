import { extend } from '@vue/shared'
import { watch } from '@vue/reactivity'
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
import { currentInstance, setCurrentInstance } from '../../internal/instance.js'
import { vShowHidden } from '../../internal/vShow.js'
import { forceReflow } from '../../internal/transitionDom.js'
import { warn } from '../../internal/warning.js'
import { insert } from '../block.js'
import { renderEffect } from '../renderEffect.js'
import { createElement } from '../dom/node.js'
import { DynamicFragment, isFragment } from '../fragment.js'
import { defineVaporComponent } from '../apiDefineComponent.js'
import { resolveDynamicProps } from '../componentProps.js'
import {
  ensureTransitionHooksRegistered,
  getTransitionElement,
  isValidTransitionBlock,
  resolveTransitionBlocks,
  resolveTransitionHooks,
  setTransitionHooks,
} from './Transition.js'

const positionMap = new WeakMap()
const newPositionMap = new WeakMap()

const transitionGroupUpdateOwnerMap = new WeakMap()

const decorate = t => {
  delete t.props.mode
  return t
}

const VaporTransitionGroupImpl = defineVaporComponent({
  name: 'VaporTransitionGroup',

  props: extend({}, TransitionPropsValidators, {
    tag: String,
    moveClass: String,
  }),

  setup(props, { slots, expose }) {
    expose()

    ensureTransitionHooksRegistered()

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

export const VaporTransitionGroup = decorate(VaporTransitionGroupImpl)

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
        setTransitionHooks(
          child,
          resolveTransitionHooks(child, props, state, instance),
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
      watch(
        () => {
          const prev = setCurrentInstance(owner, owner.scope)
          try {
            return resolveDynamicProps(owner.rawProps)
          } finally {
            setCurrentInstance(...prev)
          }
        },
        () => {
          if (isPending) return
          isPending = true
          updateHooks.beforeUpdate()
          queuePostFlushCb(flushUpdated)
        },
      )
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
