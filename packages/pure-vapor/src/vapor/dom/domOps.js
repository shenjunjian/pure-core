import {
  DomOpType,
  queueDomOp,
  runWithDomOps,
  runWithDomOpsSync,
} from '../../internal/domJobQueue.js'

export { runWithDomOps, runWithDomOpsSync }

export function domInsert(parent, node, anchor = null) {
  queueDomOp(DomOpType.INSERT_BEFORE, { parent, node, anchor })
}

export function domRemove(parent, child) {
  queueDomOp(DomOpType.REMOVE_CHILD, { parent, child })
}

export function domAppendChild(parent, child) {
  queueDomOp(DomOpType.APPEND_CHILD, { parent, child })
}

export function domPrepend(parent, child) {
  const anchor = parent.firstChild
  queueDomOp(DomOpType.INSERT_BEFORE, { parent, node: child, anchor })
}

export function domSetText(node, text) {
  queueDomOp(DomOpType.SET_TEXT, { node, text })
}

export function domSetAttr(el, name, value) {
  if (value != null) {
    queueDomOp(DomOpType.SET_ATTRIBUTE, { el, name, value })
  } else {
    queueDomOp(DomOpType.REMOVE_ATTRIBUTE, { el, name })
  }
}

export function domSetAttrNS(el, ns, name, value) {
  if (value != null) {
    queueDomOp(DomOpType.SET_ATTRIBUTE_NS, { el, ns, name, value })
  } else {
    queueDomOp(DomOpType.REMOVE_ATTRIBUTE_NS, { el, ns, name })
  }
}

export function domSetProperty(el, key, value) {
  queueDomOp(DomOpType.SET_PROPERTY, { el, key, value })
}

export function domSetClassName(el, value) {
  queueDomOp(DomOpType.CLASS_NAME, { el, value })
}

export function domSetStyle(el, property, value) {
  queueDomOp(DomOpType.STYLE, { el, property, value })
}

export function domAddEventListener(el, event, handler, options) {
  queueDomOp(DomOpType.ADD_EVENT_LISTENER, { el, event, handler, options })
}

export function domRemoveEventListener(el, event, handler, options) {
  queueDomOp(DomOpType.REMOVE_EVENT_LISTENER, { el, event, handler, options })
}

export function domSetInnerHTML(el, html) {
  queueDomOp(DomOpType.SET_INNER_HTML, { el, html })
}

export function domSetTextContent(el, text) {
  queueDomOp(DomOpType.SET_TEXT_CONTENT, { el, text })
}

export function domSetStyleProperty(style, name, value, priority) {
  queueDomOp(DomOpType.SET_STYLE_PROPERTY, {
    el: style,
    name,
    value,
    priority: priority || '',
  })
}

export function domSetStyleCssText(el, cssText) {
  queueDomOp(DomOpType.SET_STYLE_CSS_TEXT, { el, cssText })
}

/** Clear container children before app mount (queued). */
export function domMountClear(container) {
  while (container.firstChild) {
    domRemove(container, container.firstChild)
  }
}
