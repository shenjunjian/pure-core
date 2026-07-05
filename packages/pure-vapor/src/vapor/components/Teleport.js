import { getCurrentScope } from '@vue/reactivity'
import { isArray, extend } from '@vue/shared'
import { SchedulerJobFlags } from '../../internal/scheduler.js'
import {
  isTeleportDisabled,
  isTeleportDeferred,
  resolveTeleportTarget,
} from '../../internal/teleportUtils.js'
import { queuePostFlushCb } from '../../internal/scheduler.js'
import { setCurrentInstance } from '../../internal/instance.js'
import { warn } from '../../internal/warning.js'
import { insert, move, remove } from '../block.js'
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
import { MoveType } from '../../internal/transitionRuntime.js'
import { applyTransitionHooks, isTransitionEnabled } from '../transition.js'
import { enableTeleport } from '../teleport.js'
import { updateTeleportCssVars } from '../helpers/useCssVars.js'

const TeleportMountLocation = {
  None: 0,
  Main: 1,
  Target: 2,
}

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
    this.childrenInitialized = false
    this.childrenScope = getCurrentScope()
    this.mountState = { location: TeleportMountLocation.None }
    this.anchor = __DEV__ ? createComment('teleport end') : createTextNode()

    const propsProxy = new Proxy(this.rawProps, rawPropsProxyHandlers)

    renderEffect(() => {
      const prevTo = this.resolvedProps && this.resolvedProps.to
      const wasDisabled = this.isDisabled
      this.resolvedProps = extend({}, propsProxy)
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

  get scopeOwner() {
    return this.slotOwner || this.renderInstance
  }

  initChildren() {
    const prevInstance = setCurrentInstance(
      this.renderInstance,
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
    const scopeOwner = this.scopeOwner
    if (scopeOwner && scopeOwner.ut) {
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
    const mountState = this.mountState
    if (!this.parent || mountState.location === TeleportMountLocation.None) {
      this.nodes = children
      return
    }

    remove(this.nodes, mountState.container)
    this.nodes = children
    const onBeforeInsert = this.onBeforeInsert
    if (onBeforeInsert) onBeforeInsert.forEach(fn => fn(this.nodes))
    insert(children, mountState.container, mountState.anchor)
    this.bindChildren(this.nodes)
    updateTeleportCssVars(this)
  }

  mount(parent, anchor, location) {
    if (
      isTransitionEnabled &&
      this.$transition &&
      this.mountState.location === TeleportMountLocation.None
    ) {
      applyTransitionHooks(this.nodes, this.$transition)
    }
    if (this.mountState.location !== TeleportMountLocation.None) {
      move(this.nodes, parent, anchor, MoveType.REORDER)
    } else {
      const onBeforeInsert = this.onBeforeInsert
      if (onBeforeInsert) onBeforeInsert.forEach(fn => fn(this.nodes))
      insert(this.nodes, parent, anchor)
    }
    this.mountState = { location, container: parent, anchor }
    updateTeleportCssVars(this)
  }

  prepareTargetAnchors(target) {
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
  }

  prepareTarget() {
    const target = (this.target = resolveTeleportTarget(
      this.resolvedProps,
      querySelector,
    ))
    if (target) {
      this.prepareTargetAnchors(target)

      const scopeOwner = this.scopeOwner
      if (scopeOwner && scopeOwner.isCE) {
        const ce = scopeOwner.ce
        if (!ce._teleportTargets) ce._teleportTargets = new Set()
        ce._teleportTargets.add(target)
      }
    }
    return target
  }

  queueTargetUpdate() {
    if (
      !this.mountToTargetJob ||
      this.mountToTargetJob.flags & SchedulerJobFlags.DISPOSED
    ) {
      this.mountToTargetJob = () => {
        this.mountToTargetJob = undefined
        if (!this.anchor) return
        if (this.isDisabled) {
          if (!this.targetAnchor) {
            this.prepareTarget()
          }
        } else {
          this.mountToTarget()
        }
      }
    }
    queuePostFlushCb(this.mountToTargetJob)
  }

  mountToTarget() {
    const target = this.prepareTarget()
    if (target) {
      this.ensureChildrenInitialized()
      this.mount(target, this.targetAnchor, TeleportMountLocation.Target)
    } else if (__DEV__) {
      warn(
        `Invalid Teleport target on ${this.targetAnchor ? 'update' : 'mount'}:`,
        target,
        `(${typeof target})`,
      )
    }
  }

  handlePropsUpdate() {
    if (!this.parent) return

    if (this.isDisabled) {
      this.ensureChildrenInitialized()
      this.mount(this.parent, this.anchor, TeleportMountLocation.Main)
      if (!this.targetAnchor) {
        if (
          isTeleportDeferred(this.resolvedProps) ||
          !this.parent.isConnected
        ) {
          this.queueTargetUpdate()
        } else {
          this.prepareTarget()
        }
      }
    } else {
      if (isTeleportDeferred(this.resolvedProps) || !this.parent.isConnected) {
        this.queueTargetUpdate()
      } else {
        this.mountToTarget()
      }
    }
  }

  insert = (container, anchor) => {
    const wasMountedInTarget =
      this.mountState.location === TeleportMountLocation.Target

    if (!this.placeholder) {
      this.placeholder = __DEV__
        ? createComment('teleport start')
        : createTextNode()
    }

    insert(this.placeholder, container, anchor)
    insert(this.anchor, container, anchor)
    if (!wasMountedInTarget) {
      this.handlePropsUpdate()
    }
  }

  dispose = () => {
    if (this.mountToTargetJob) {
      this.mountToTargetJob.flags |= SchedulerJobFlags.DISPOSED
      this.mountToTargetJob = undefined
    }

    const mountState = this.mountState
    if (this.nodes && mountState.location !== TeleportMountLocation.None) {
      remove(this.nodes, mountState.container)
      this.nodes = []
    }

    this.mountState = { location: TeleportMountLocation.None }

    if (this.targetStart) {
      remove(this.targetStart, parentNode(this.targetStart))
      this.targetStart = undefined
    }
    if (this.targetAnchor) {
      remove(this.targetAnchor, parentNode(this.targetAnchor))
      this.targetAnchor = undefined
    }

    this.target = undefined
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

export { TeleportMountLocation }
