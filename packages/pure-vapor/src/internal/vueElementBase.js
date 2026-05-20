import { unref } from '@vue/reactivity'
import {
  camelize,
  extend,
  hasOwn,
  hyphenate,
  isArray,
  isPlainObject,
  toNumber,
} from '@vue/shared'
import { nextTick } from './scheduler.js'
import { warn } from './warning.js'

const REMOVAL = {}

const BaseClass = typeof HTMLElement !== 'undefined' ? HTMLElement : class {}

export class VueElementBase extends BaseClass {
  constructor(def, props = {}, createAppFn) {
    super()
    this._isVueCE = true
    this._instance = null
    this._app = null
    this._nonce = def.nonce
    this._connected = false
    this._resolved = false
    this._numberProps = null
    this._styleChildren = new WeakSet()
    this._styleAnchors = new WeakMap()
    this._patching = false
    this._dirty = false
    this._def = def
    this._props = props
    this._createApp = createAppFn

    if (this._needsHydration()) {
      this._root = this.shadowRoot
    } else if (def.shadowRoot !== false) {
      this.attachShadow(
        extend({}, def.shadowRootOptions, {
          mode: 'open',
        }),
      )
      this._root = this.shadowRoot
    } else {
      this._root = this
    }
  }

  connectedCallback() {
    if (!this.isConnected) return

    if (!this.shadowRoot && !this._resolved) {
      this._parseSlots()
    }
    this._connected = true

    let parent = this
    while (
      (parent =
        parent && (parent.assignedSlot || parent.parentNode || parent.host))
    ) {
      if (parent instanceof VueElementBase) {
        this._parent = parent
        break
      }
    }

    if (!this._instance) {
      if (this._resolved) {
        this._mountComponent(this._def)
      } else {
        if (parent && parent._pendingResolve) {
          this._pendingResolve = parent._pendingResolve.then(() => {
            this._pendingResolve = undefined
            this._resolveDef()
          })
        } else {
          this._resolveDef()
        }
      }
    }
  }

  disconnectedCallback() {
    this._connected = false
    nextTick(() => {
      if (!this._connected) {
        if (this._ob) {
          this._ob.disconnect()
          this._ob = null
        }
        this._unmount()
        if (this._teleportTargets) {
          this._teleportTargets.clear()
          this._teleportTargets = undefined
        }
      }
    })
  }

  _setParent(parent = this._parent) {
    if (parent && this._instance) {
      this._instance.parent = parent._instance
      this._inheritParentContext(parent)
    }
  }

  _inheritParentContext(parent = this._parent) {
    if (parent && this._app) {
      Object.setPrototypeOf(
        this._app._context.provides,
        parent._instance.provides,
      )
    }
  }

  _processMutations(mutations) {
    for (let i = 0; i < mutations.length; i++) {
      this._setAttr(mutations[i].attributeName)
    }
  }

  _resolveDef() {
    if (this._pendingResolve) {
      return
    }

    for (let i = 0; i < this.attributes.length; i++) {
      this._setAttr(this.attributes[i].name)
    }

    this._ob = new MutationObserver(this._processMutations.bind(this))
    this._ob.observe(this, { attributes: true })

    const resolve = def => {
      this._resolved = true
      this._pendingResolve = undefined

      const props = def.props
      const styles = def.styles
      let numberProps
      if (props && !isArray(props)) {
        for (const key in props) {
          const opt = props[key]
          if (opt === Number || (opt && opt.type === Number)) {
            if (key in this._props) {
              this._props[key] = toNumber(this._props[key])
            }
            ;(numberProps || (numberProps = Object.create(null)))[
              camelize(key)
            ] = true
          }
        }
      }
      this._numberProps = numberProps
      this._resolveProps(def)

      if (this.shadowRoot) {
        this._applyStyles(styles)
      } else if (__DEV__ && styles) {
        warn(
          'Custom element style injection is not supported when using ' +
            'shadowRoot: false',
        )
      }

      this._mountComponent(def)
    }

    const asyncDef = this._def.__asyncLoader
    if (asyncDef) {
      const configureApp = this._def.configureApp
      this._pendingResolve = asyncDef().then(def => {
        def.configureApp = configureApp
        this._def = def
        resolve(def)
      })
    } else {
      resolve(this._def)
    }
  }

  _mountComponent(def) {
    this._mount(def)
    this._processExposed()
  }

  _processExposed() {
    const exposed = this._instance && this._instance.exposed
    if (!exposed) return
    for (const key in exposed) {
      if (!hasOwn(this, key)) {
        Object.defineProperty(this, key, {
          get: () => unref(exposed[key]),
        })
      } else if (__DEV__) {
        warn(`Exposed property "${key}" already exists on custom element.`)
      }
    }
  }

  _processInstance() {
    this._instance.ce = this
    this._instance.isCE = true

    if (__DEV__) {
      this._instance.ceReload = newStyles => {
        if (this._styles) {
          this._styles.forEach(s => this._root.removeChild(s))
          this._styles.length = 0
        }
        this._styleAnchors.delete(this._def)
        this._applyStyles(newStyles)
        this._update()
      }
    }

    const dispatch = (event, args) => {
      this.dispatchEvent(
        new CustomEvent(
          event,
          isPlainObject(args[0])
            ? extend({ detail: args }, args[0])
            : { detail: args },
        ),
      )
    }

    this._instance.emit = (event, ...args) => {
      dispatch(event, args)
      if (hyphenate(event) !== event) {
        dispatch(hyphenate(event), args)
      }
    }

    this._setParent()
  }

  _resolveProps(def) {
    const props = def.props
    const declaredPropKeys = isArray(props) ? props : Object.keys(props || {})

    for (const key of Object.keys(this)) {
      if (key[0] !== '_' && declaredPropKeys.includes(key)) {
        this._setProp(key, this[key])
      }
    }

    for (let i = 0; i < declaredPropKeys.length; i++) {
      const key = camelize(declaredPropKeys[i])
      Object.defineProperty(this, key, {
        get() {
          return this._getProp(key)
        },
        set(val) {
          this._setProp(key, val, true, !this._patching)
        },
      })
    }
  }

  _setAttr(key) {
    if (key.startsWith('data-v-')) return
    const has = this.hasAttribute(key)
    let value = has ? this.getAttribute(key) : REMOVAL
    const camelKey = camelize(key)
    if (has && this._numberProps && this._numberProps[camelKey]) {
      value = toNumber(value)
    }
    this._setProp(camelKey, value, false, true)
  }

  _getProp(key) {
    return this._props[key]
  }

  _setProp(key, val, shouldReflect = true, shouldUpdate = false) {
    if (val !== this._props[key]) {
      this._dirty = true
      if (val === REMOVAL) {
        delete this._props[key]
      } else {
        this._props[key] = val
      }
      if (shouldUpdate && this._instance) {
        this._update()
      }
      if (shouldReflect) {
        const ob = this._ob
        if (ob) {
          this._processMutations(ob.takeRecords())
          ob.disconnect()
        }
        if (val === true) {
          this.setAttribute(hyphenate(key), '')
        } else if (typeof val === 'string' || typeof val === 'number') {
          this.setAttribute(hyphenate(key), val + '')
        } else if (!val) {
          this.removeAttribute(hyphenate(key))
        }
        if (ob) ob.observe(this, { attributes: true })
      }
    }
  }

  _applyStyles(styles, owner, parentComp) {
    if (!styles) return
    if (owner) {
      if (owner === this._def || this._styleChildren.has(owner)) {
        return
      }
      this._styleChildren.add(owner)
    }

    const nonce = this._nonce
    const root = this.shadowRoot
    const insertionAnchor = parentComp
      ? this._getStyleAnchor(parentComp) || this._getStyleAnchor(this._def)
      : this._getRootStyleInsertionAnchor(root)
    let last = null
    for (let i = styles.length - 1; i >= 0; i--) {
      const s = document.createElement('style')
      if (nonce) s.setAttribute('nonce', nonce)
      s.textContent = styles[i]
      root.insertBefore(s, last || insertionAnchor)
      last = s
      if (i === 0) {
        if (!parentComp) this._styleAnchors.set(this._def, s)
        if (owner) this._styleAnchors.set(owner, s)
      }
      if (__DEV__) {
        if (owner) {
          if (owner.__hmrId) {
            if (!this._childStyles) this._childStyles = new Map()
            let entry = this._childStyles.get(owner.__hmrId)
            if (!entry) {
              this._childStyles.set(owner.__hmrId, (entry = []))
            }
            entry.push(s)
          }
        } else {
          ;(this._styles || (this._styles = [])).push(s)
        }
      }
    }
  }

  _getStyleAnchor(comp) {
    if (!comp) return null
    const anchor = this._styleAnchors.get(comp)
    if (anchor && anchor.parentNode === this.shadowRoot) {
      return anchor
    }
    if (anchor) {
      this._styleAnchors.delete(comp)
    }
    return null
  }

  _getRootStyleInsertionAnchor(root) {
    for (let i = 0; i < root.childNodes.length; i++) {
      const node = root.childNodes[i]
      if (!(node instanceof HTMLStyleElement)) {
        return node
      }
    }
    return null
  }

  _parseSlots() {
    const slots = (this._slots = {})
    let n
    while ((n = this.firstChild)) {
      const slotName = (n.nodeType === 1 && n.getAttribute('slot')) || 'default'
      ;(slots[slotName] || (slots[slotName] = [])).push(n)
      this.removeChild(n)
    }
  }

  _renderSlots() {
    const outlets = this._getSlots()
    const scopeId = this._instance.type.__scopeId
    const slotReplacements = new Map()

    for (let i = 0; i < outlets.length; i++) {
      const o = outlets[i]
      const slotName = o.getAttribute('name') || 'default'
      const content = this._slots[slotName]
      const parent = o.parentNode
      const replacementNodes = []

      if (content) {
        for (let j = 0; j < content.length; j++) {
          const n = content[j]
          if (scopeId && n.nodeType === 1) {
            const id = scopeId + '-s'
            const walker = document.createTreeWalker(n, 1)
            n.setAttribute(id, '')
            let child
            while ((child = walker.nextNode())) {
              child.setAttribute(id, '')
            }
          }
          parent.insertBefore(n, o)
          replacementNodes.push(n)
        }
      } else {
        while (o.firstChild) {
          const child = o.firstChild
          parent.insertBefore(child, o)
          replacementNodes.push(child)
        }
      }
      parent.removeChild(o)
      slotReplacements.set(o, {
        nodes: replacementNodes,
        usedFallback: !content,
      })
    }

    this._updateSlotNodes(slotReplacements)
  }

  _getSlots() {
    const roots = [this]
    if (this._teleportTargets) {
      roots.push(...this._teleportTargets)
    }

    const slots = new Set()
    for (let i = 0; i < roots.length; i++) {
      const found = roots[i].querySelectorAll('slot')
      for (let j = 0; j < found.length; j++) {
        slots.add(found[j])
      }
    }

    return Array.from(slots)
  }

  _injectChildStyle(comp, parentComp) {
    this._applyStyles(comp.styles, comp, parentComp)
  }

  _beginPatch() {
    this._patching = true
    this._dirty = false
  }

  _endPatch() {
    this._patching = false
    if (this._dirty && this._instance) {
      this._update()
    }
  }

  _hasShadowRoot() {
    return this._def.shadowRoot !== false
  }

  _removeChildStyle(comp) {
    if (__DEV__) {
      this._styleChildren.delete(comp)
      this._styleAnchors.delete(comp)
      if (this._childStyles && comp.__hmrId) {
        const oldStyles = this._childStyles.get(comp.__hmrId)
        if (oldStyles) {
          oldStyles.forEach(s => this._root.removeChild(s))
          oldStyles.length = 0
        }
      }
    }
  }

  _needsHydration() {
    return false
  }
}
