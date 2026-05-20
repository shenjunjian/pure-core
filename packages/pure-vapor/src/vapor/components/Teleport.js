import { getCurrentScope } from '@vue/reactivity'
import { isArray, extend } from '@vue/shared'
import { SchedulerJobFlags } from '../../internal/scheduler.js'
import {
  isTeleportDisabled,
  isTeleportDeferred,
  resolveTeleportTarget,
} from '../../internal/teleportUtils.js'
import { queuePostFlushCb } from '../../internal/scheduler.js'
import { currentInstance, setCurrentInstance } from '../../internal/instance.js'
import { warn } from '../../internal/warning.js'
import { insert, remove } from '../block.js'
import {
  createComment,
  createTextNode,
  parentNode,
  querySelector,
} from '../dom/node.js'
import { isVaporComponent } from '../component.js'
import { rawPropsProxyHandlers } from '../componentProps.js'
import { renderEffect } from '../renderEffect.js'
import { VaporFragment, isFragment } from '../fragment.js'
import { getScopeOwner } from '../componentSlots.js'
import { enableTeleport } from '../teleport.js'
import { updateTeleportCssVars } from '../helpers/useCssVars.js'

const VaporTeleportImpl = {
  name: 'VaporTeleport',
  __isTeleport: true,
  __vapor: true,

  process(props, slots) {
    return new TeleportFragment(props, slots)
  },
}

export class TeleportFragment extends VaporFragment {
  constructor(props, slots) {
    super([])
    this.__isTeleportFragment = true
    this.rawProps = props
    this.resolvedProps = null
    this.rawSlots = slots
    this.isDisabled = false
    this.isMounted = false
    this.childrenInitialized = false
    this.ownerInstance = currentInstance
    this.childrenScope = getCurrentScope()
    this.parentComponent = getScopeOwner()
    this.anchor = __DEV__ ? createComment('teleport end') : createTextNode()

    renderEffect(() => {
      const prevTo = this.resolvedProps && this.resolvedProps.to
      const wasDisabled = this.isDisabled
      this.resolvedProps = extend(
        {},
        new Proxy(this.rawProps, rawPropsProxyHandlers),
      )
      this.isDisabled = isTeleportDisabled(this.resolvedProps)
      if (
        wasDisabled !== this.isDisabled ||
        (!this.isDisabled && prevTo !== this.resolvedProps.to)
      ) {
        this.handlePropsUpdate()
      }
    })
  }

  get parent() {
    return this.anchor ? parentNode(this.anchor) : null
  }

  initChildren() {
    const prevInstance = setCurrentInstance(
      this.ownerInstance,
      this.childrenScope,
    )
    try {
      this.childrenInitialized = true
      renderEffect(() =>
        this.runWithRenderCtx(
          () =>
            this.handleChildrenUpdate(
              this.rawSlots && this.rawSlots.default
                ? this.rawSlots.default()
                : [],
            ),
          this.childrenScope,
        ),
      )
      this.bindChildren(this.nodes)
    } finally {
      setCurrentInstance(...prevInstance)
    }
  }

  ensureChildrenInitialized() {
    if (!this.childrenInitialized) {
      this.initChildren()
    }
  }

  registerUpdateCssVars(block) {
    if (isFragment(block)) {
      ;(block.onUpdated || (block.onUpdated = [])).push(() =>
        updateTeleportCssVars(this),
      )
      this.registerUpdateCssVars(block.nodes)
    } else if (isVaporComponent(block)) {
      this.registerUpdateCssVars(block.block)
    } else if (isArray(block)) {
      for (let i = 0; i < block.length; i++) {
        this.registerUpdateCssVars(block[i])
      }
    }
  }

  bindChildren(block) {
    if (this.parentComponent && this.parentComponent.ut) {
      this.registerUpdateCssVars(block)
    }
    if (__DEV__) {
      if (isVaporComponent(block)) {
        block.parentTeleport = this
      } else if (isArray(block)) {
        for (let i = 0; i < block.length; i++) {
          const node = block[i]
          if (isVaporComponent(node)) node.parentTeleport = this
        }
      }
    }
  }

  handleChildrenUpdate(children) {
    if (!this.parent || !this.mountContainer) {
      this.nodes = children
      return
    }
    remove(this.nodes, this.mountContainer)
    insert((this.nodes = children), this.mountContainer, this.mountAnchor)
    this.bindChildren(this.nodes)
    updateTeleportCssVars(this)
  }

  mount(parent, anchor) {
    if (this.isMounted) {
      insert(
        this.nodes,
        (this.mountContainer = parent),
        (this.mountAnchor = anchor),
      )
    } else {
      insert(
        this.nodes,
        (this.mountContainer = parent),
        (this.mountAnchor = anchor),
      )
      this.isMounted = true
    }
    updateTeleportCssVars(this)
  }

  mountToTarget() {
    const target = (this.target = resolveTeleportTarget(
      this.resolvedProps,
      querySelector,
    ))
    if (target) {
      if (!this.targetAnchor || parentNode(this.targetAnchor) !== target) {
        if (this.targetStart) {
          remove(this.targetStart, parentNode(this.targetStart))
        }
        if (this.targetAnchor) {
          remove(this.targetAnchor, parentNode(this.targetAnchor))
        }
        insert((this.targetStart = createTextNode('')), target)
        insert((this.targetAnchor = createTextNode('')), target)
      }

      this.ensureChildrenInitialized()

      if (this.parentComponent && this.parentComponent.isCE) {
        const ce = this.parentComponent.ce
        if (!ce._teleportTargets) ce._teleportTargets = new Set()
        ce._teleportTargets.add(target)
      }

      this.mount(target, this.targetAnchor)
    } else if (__DEV__) {
      warn(
        `Invalid Teleport target on ${this.targetAnchor ? 'update' : 'mount'}:`,
        target,
        `(${typeof target})`,
      )
    }
  }

  clearMainViewChildren() {
    if (!this.placeholder || !this.anchor) return

    let node = this.placeholder.nextSibling
    while (node && node !== this.anchor) {
      const next = node.nextSibling
      remove(node, parentNode(node))
      node = next
    }

    this.isMounted = false
    this.mountContainer = null
  }

  handlePropsUpdate() {
    if (!this.parent) return

    if (this.isDisabled) {
      this.ensureChildrenInitialized()
      this.mount(this.parent, this.anchor)
    } else {
      if (
        this.placeholder &&
        this.anchor &&
        this.placeholder.nextSibling !== this.anchor
      ) {
        this.clearMainViewChildren()
      }

      if (isTeleportDeferred(this.resolvedProps) || !this.parent.isConnected) {
        if (
          !this.mountToTargetJob ||
          this.mountToTargetJob.flags & SchedulerJobFlags.DISPOSED
        ) {
          this.mountToTargetJob = () => {
            this.mountToTargetJob = undefined
            if (this.isDisabled || !this.anchor) return
            this.mountToTarget()
          }
        }
        queuePostFlushCb(this.mountToTargetJob)
      } else {
        this.mountToTarget()
      }
    }
  }

  insert = (container, anchor) => {
    if (!this.placeholder) {
      this.placeholder = __DEV__
        ? createComment('teleport start')
        : createTextNode()
    }

    insert(this.placeholder, container, anchor)
    insert(this.anchor, container, anchor)
    this.handlePropsUpdate()
  }

  dispose = () => {
    if (this.mountToTargetJob) {
      this.mountToTargetJob.flags |= SchedulerJobFlags.DISPOSED
      this.mountToTargetJob = undefined
    }

    if (this.nodes && this.mountContainer) {
      remove(this.nodes, this.mountContainer)
      this.nodes = []
    }

    this.isMounted = false

    if (this.targetStart) {
      remove(this.targetStart, parentNode(this.targetStart))
      this.targetStart = undefined
    }
    if (this.targetAnchor) {
      remove(this.targetAnchor, parentNode(this.targetAnchor))
      this.targetAnchor = undefined
    }

    this.target = undefined
    this.mountContainer = undefined
    this.mountAnchor = undefined
  }

  remove = () => {
    this.dispose()

    if (this.anchor) {
      remove(this.anchor, parentNode(this.anchor))
      this.anchor = undefined
    }

    if (this.placeholder) {
      remove(this.placeholder, parentNode(this.placeholder))
      this.placeholder = undefined
    }
  }
}

export const VaporTeleport = /*@__PURE__*/ enableTeleport(VaporTeleportImpl)
