export function domInsert(parent, node, anchor = null) {
  parent.insertBefore(node, anchor)
}

export function domRemove(parent, child) {
  parent.removeChild(child)
}

export function domAppendChild(parent, child) {
  parent.appendChild(child)
}

export function domPrepend(parent, child) {
  const anchor = parent.firstChild
  parent.insertBefore(child, anchor)
}

export function domSetText(node, text) {
  node.textContent = text
}

export function domSetAttr(el, name, value) {
  if (value != null) {
    el.setAttribute(name, value)
  } else {
    el.removeAttribute(name)
  }
}

export function domSetAttrNS(el, ns, name, value) {
  if (value != null) {
    el.setAttributeNS(ns, name, value)
  } else {
    el.removeAttributeNS(ns, name)
  }
}

export function domSetProperty(el, key, value) {
  el[key] = value
}

export function domSetClassName(el, value) {
  el.className = value
}

export function domSetStyle(style, property, value) {
  style[property] = value
}

export function domAddEventListener(el, event, handler, options) {
  el.addEventListener(event, handler, options)
}

export function domRemoveEventListener(el, event, handler, options) {
  el.removeEventListener(event, handler, options)
}

export function domSetInnerHTML(el, html) {
  el.innerHTML = html
}

export function domSetTextContent(el, text) {
  el.textContent = text
}

export function domSetStyleProperty(style, name, value, priority) {
  style.setProperty(name, value, priority || '')
}

export function domSetStyleCssText(el, cssText) {
  el.style.cssText = cssText
}

/** Clear container children before app mount. */
export function domMountClear(container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild)
  }
}
