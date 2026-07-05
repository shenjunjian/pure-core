import { onEffectCleanup } from '@vue/reactivity'
import { hyphenate, isArray } from '@vue/shared'
import {
  ErrorCodes,
  callWithAsyncErrorHandling,
} from '../../internal/errorHandling.js'
import { currentInstance } from '../../internal/instance.js'
import {
  withKeys as withDomKeys,
  withModifiers as withDomModifiers,
} from '../../internal/eventModifiers.js'
import { domAddEventListener, domRemoveEventListener } from './domOps.js'

export function addEventListener(el, event, handler, options) {
  domAddEventListener(el, event, handler, options)
  return () => domRemoveEventListener(el, event, handler, options)
}

export function on(el, event, handler, options = {}) {
  if (isArray(handler)) {
    for (let i = 0; i < handler.length; i++) {
      on(el, event, handler[i], options)
    }
  } else {
    if (!handler) return
    addEventListener(el, event, createInvoker(handler), options)
  }
}

const optionsModifierRE = /(?:Once|Passive|Capture)$/

export function parseEventName(name) {
  let options
  if (optionsModifierRE.test(name)) {
    options = {}
    let m
    while ((m = name.match(optionsModifierRE))) {
      name = name.slice(0, name.length - m[0].length)
      options[m[0].toLowerCase()] = true
    }
  }
  const event = name[2] === ':' ? name.slice(3) : hyphenate(name.slice(2))
  return [event, options]
}

export function onBinding(el, event, handler, options = {}) {
  if (isArray(handler)) {
    for (let i = 0; i < handler.length; i++) {
      onBinding(el, event, handler[i], options)
    }
  } else {
    if (!handler) return
    const cleanup = addEventListener(el, event, createInvoker(handler), options)
    onEffectCleanup(cleanup)
  }
}

export function delegate(el, event, handler) {
  const key = `$evt${event}`
  const existing = el[key]
  const invoker = createInvoker(handler)
  if (existing) {
    if (isArray(existing)) {
      existing.push(invoker)
    } else {
      el[key] = [existing, invoker]
    }
  } else {
    el[key] = invoker
  }
}

const delegatedEvents = /*@__PURE__*/ Object.create(null)

export function delegateEvents(...names) {
  for (let i = 0; i < names.length; i++) {
    const name = names[i]
    if (!delegatedEvents[name]) {
      delegatedEvents[name] = true
      document.addEventListener(name, delegatedEventHandler)
    }
  }
}

const delegatedEventHandler = e => {
  let node = (e.composedPath && e.composedPath()[0]) || e.target
  if (e.target !== node) {
    Object.defineProperty(e, 'target', {
      configurable: true,
      value: node,
    })
  }
  Object.defineProperty(e, 'currentTarget', {
    configurable: true,
    get() {
      return node || document
    },
  })
  while (node !== null) {
    const handlers = node[`$evt${e.type}`]
    if (handlers) {
      if (isArray(handlers)) {
        for (let i = 0; i < handlers.length; i++) {
          if (!node.disabled) {
            handlers[i](e)
            if (e.cancelBubble) return
          }
        }
      } else {
        handlers(e)
        if (e.cancelBubble) return
      }
    }
    node =
      node.host && node.host !== node && node.host instanceof Node
        ? node.host
        : node.parentNode
  }
}

export function setDynamicEvents(el, events) {
  for (const name in events) {
    onBinding(el, name, events[name])
  }
}

export function withVaporModifiers(fn, modifiers) {
  return createInvoker(
    typeof fn === 'function' ? withDomModifiers(fn, modifiers) : fn,
  )
}

export function withVaporKeys(fn, modifiers) {
  return createInvoker(
    typeof fn === 'function' ? withDomKeys(fn, modifiers) : fn,
  )
}

export function createInvoker(handler) {
  const i = currentInstance
  return (...args) =>
    callWithAsyncErrorHandling(
      handler,
      i,
      ErrorCodes.NATIVE_EVENT_HANDLER,
      args,
    )
}
