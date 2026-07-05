/**
 * VaporTransitionGroup component for pure-vapor.
 * Full FLIP animation support ported from runtime-dom.
 */

import { extend } from '@vue/shared'
import { renderEffect } from '../renderEffect.js'
import { getCurrentInstance } from '../../internal/instance.js'
import { useTransitionState } from '../../internal/transition.js'
import { ensureTransitionHooksRegistered } from './Transition.js'
import {
  resolveTransitionBlocks,
  resolveTransitionHooks,
  getTransitionElement,
} from './Transition.js'
import {
  recordPosition,
  recordNewPosition,
  applyTranslation,
  hasCSSTransform,
  handleMovedChildren,
  callPendingCbs,
  forceReflow,
} from './transition-flip.js'
import { defineVaporComponent } from '../apiDefineComponent.js'
import { DynamicFragment } from '../fragment.js'
import { createElement } from '../dom/node.js'
import { insert } from '../block.js'
import { onBeforeUpdate, onUpdated } from '../../internal/lifecycle.js'
import { queuePostFlushCb } from '../../internal/scheduler.js'

// TransitionGroup props validators
const TransitionGroupPropsValidators = /*@__PURE__*/ extend(
  {},
  {
    name: String,
    type: String,
    css: Boolean,
    duration: [String, Number, Object],
    enterFromClass: String,
    enterActiveClass: String,
    enterToClass: String,
    appearFromClass: String,
    appearActiveClass: String,
    appearToClass: String,
    leaveFromClass: String,
    leaveActiveClass: String,
    leaveToClass: String,
    persisted: Boolean,
    tag: String,
    moveClass: String,
  },
)

const VaporTransitionGroupImpl = defineVaporComponent({
  name: 'VaporTransitionGroup',

  props: TransitionGroupPropsValidators,

  setup(props, { slots, expose }) {
    expose()

    // Register transition hooks on first use
    ensureTransitionHooksRegistered()

    const instance = getCurrentInstance()
    const state = useTransitionState()

    // Check that mode is not set (invalid for TransitionGroup)
    if (__DEV__ && props.mode) {
      console.warn('<transition-group> does not support mode prop.')
    }

    // Use proxy to keep props reference stable
    let cssTransitionProps = {}
    const propsProxy = new Proxy(
      {},
      {
        get(_, key) {
          return cssTransitionProps[key]
        },
      },
    )

    renderEffect(() => {
      cssTransitionProps = { ...props }
      delete cssTransitionProps.tag
      delete cssTransitionProps.moveClass
    }, true)

    let prevChildren = []
    let isUpdatePending = false
    let slottedBlock = []

    const beforeUpdate = () => {
      if (isUpdatePending) return
      isUpdatePending = true
      prevChildren = []

      const children = resolveTransitionBlocks(slottedBlock)
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        const el = child.$transition ? getTransitionElement(child) : undefined

        if (el && el.isConnected) {
          // Skip hidden v-show nodes - they have no layout box to animate from
          if (el.style.display === 'none') continue

          prevChildren.push({ child, el })
          // Disable transitions during measurement
          if (child.$transition) {
            child.$transition.disabled = true
          }
          // Record initial position
          recordPosition(el)
        }
      }
    }

    const updated = () => {
      if (!isUpdatePending) return
      isUpdatePending = false

      if (!prevChildren.length) return

      const moveClass = props.moveClass || `${props.name || 'v'}-move`

      // Get the first connected child to test for CSS transforms
      const firstChild = prevChildren.find(item => item.el.isConnected)
      const hasMove =
        firstChild &&
        hasCSSTransform(firstChild.el, firstChild.el.parentNode, moveClass)

      // Call any pending callbacks and re-enable transitions
      prevChildren.forEach(({ child, el }) => {
        if (child.$transition) {
          child.$transition.disabled = false
        }
        if (hasMove) {
          callPendingCbs(el)
        }
      })

      if (!hasMove) {
        prevChildren = []
        return
      }

      // Record new positions after DOM update
      prevChildren.forEach(({ el }) => {
        recordNewPosition(el)
      })

      // Apply translations to elements that moved
      const movedChildren = prevChildren
        .filter(({ child, el }) => {
          return applyTranslation(el, el)
        })
        .map(({ child }) => child)

      // Force reflow to ensure transforms are applied
      forceReflow()

      // Apply move class and set up transition end handlers
      movedChildren.forEach(child => {
        const el = getTransitionElement(child)
        if (el) {
          handleMovedChildren(el, moveClass)
        }
      })

      prevChildren = []
    }

    onBeforeUpdate(beforeUpdate)
    onUpdated(updated)

    const frag = new DynamicFragment('transition-group')
    let currentTag = undefined
    let currentSlot = undefined
    let isMounted = false

    renderEffect(() => {
      const tag = props.tag
      const slot = slots.default

      // If tag and slot are the same, no need to update
      if (isMounted && tag === currentTag && slot === currentSlot) return

      const container = tag ? createElement(tag) : undefined

      let block = slottedBlock
      let transitionBlocks = []

      frag.update(() => {
        block = (slot && slot()) || []

        transitionBlocks = applyGroupTransitionHooks(
          block,
          propsProxy,
          state,
          instance,
          { beforeUpdate, updated },
        )

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

export const VaporTransitionGroup = VaporTransitionGroupImpl

/**
 * Apply transition hooks to group children
 */
function applyGroupTransitionHooks(block, props, state, instance, updateHooks) {
  const fragments = []
  const children = resolveTransitionBlocks(block, frag => fragments.push(frag))

  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const el = getTransitionElement(child)

    if (el) {
      if (child.$key != null) {
        child.$transition = resolveTransitionHooks(
          child,
          props,
          state,
          instance,
        )
      } else if (__DEV__) {
        console.warn('<transition-group> children must be keyed')
      }
    }
  }

  // Propagate hooks to inner fragments
  fragments.forEach(frag => {
    const hooks = resolveTransitionHooks(frag, props, state, instance)
    hooks.applyGroup = (block, props, state, instance) =>
      applyGroupTransitionHooks(block, props, state, instance, updateHooks)
    frag.$transition = hooks
  })

  return children
}

VaporTransitionGroup.displayName = 'VaporTransitionGroup'
VaporTransitionGroup.props = TransitionGroupPropsValidators
VaporTransitionGroup.__vapor = true
