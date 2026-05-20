import { extend, isPlainObject } from '@vue/shared'
import { warn } from '../internal/warning.js'
import { VueElementBase } from '../internal/vueElementBase.js'
import { createComponent } from './component.js'
import { createVaporApp } from './apiCreateApp.js'
import { defineVaporComponent } from './apiDefineComponent.js'
import { isFragment, SlotFragment } from './fragment.js'

/*@__NO_SIDE_EFFECTS__*/
export function defineVaporCustomElement(options, extraOptions, _createApp) {
  let Comp = defineVaporComponent(options, extraOptions)
  if (isPlainObject(Comp)) Comp = extend({}, Comp, extraOptions)
  class VaporCustomElement extends VaporElement {
    static def = Comp
    constructor(initialProps) {
      super(Comp, initialProps, _createApp)
    }
  }
  return VaporCustomElement
}

export class VaporElement extends VueElementBase {
  constructor(def, props, createAppFn) {
    super(def, props, createAppFn || createVaporApp)
  }

  _mount(def) {
    if (__DEV__ && !def.name) {
      def.name = 'VaporElement'
    }
    this._app = this._createApp(this._def)
    this._inheritParentContext()
    if (this._def.configureApp) {
      this._def.configureApp(this._app)
    }
    this._createComponent()
    this._app.mount(this._root)
    if (!this.shadowRoot) {
      this._renderSlots()
    }
  }

  _update() {
    if (!this._app) return
    const renderEffects = this._instance.renderEffects
    if (renderEffects) {
      for (let i = 0; i < renderEffects.length; i++) {
        renderEffects[i].run()
      }
    }
  }

  _unmount() {
    if (__TEST__) {
      try {
        this._app.unmount()
      } catch (error) {
        if (
          error instanceof ReferenceError &&
          error.message.includes('Node is not defined')
        ) {
          // ignore teardown errors in tests
        } else {
          throw error
        }
      }
    } else {
      this._app.unmount()
    }
    if (this._instance && this._instance.ce) {
      this._instance.ce = undefined
    }
    this._app = this._instance = null
  }

  _updateSlotNodes(replacements) {
    this._updateFragmentNodes(this._instance.block, replacements)
  }

  _updateFragmentNodes(block, replacements) {
    if (Array.isArray(block)) {
      for (let i = 0; i < block.length; i++) {
        this._updateFragmentNodes(block[i], replacements)
      }
      return
    }

    if (!isFragment(block)) return
    const nodes = block.nodes
    if (nodes instanceof HTMLSlotElement) {
      const replacement = replacements.get(nodes)
      if (!replacement) return

      if (
        replacement.usedFallback &&
        block instanceof SlotFragment &&
        block.customElementFallback
      ) {
        this._updateFragmentNodes(block.customElementFallback, replacements)
        block.nodes = block.customElementFallback
      } else {
        block.nodes = replacement.nodes
      }
    } else if (Array.isArray(nodes)) {
      for (let i = 0; i < nodes.length; i++) {
        this._updateFragmentNodes(nodes[i], replacements)
      }
    } else {
      this._updateFragmentNodes(nodes, replacements)
    }
  }

  _createComponent() {
    this._def.ce = instance => {
      this._app._ceComponent = this._instance = instance
      if (!this.shadowRoot) {
        this._instance.u = [this._renderSlots.bind(this)]
      }
      this._processInstance()
    }

    createComponent(
      this._def,
      this._props,
      undefined,
      undefined,
      undefined,
      this._app._context,
    )
  }
}
