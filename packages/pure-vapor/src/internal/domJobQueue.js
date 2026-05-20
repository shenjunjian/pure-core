/**
 * DOM job queue: record DOM writes during a reactive flush, play them in one rAF,
 * then flush nextTick callbacks.
 */

export const DomOpType = {
  INSERT_BEFORE: 'insertBefore',
  REMOVE_CHILD: 'removeChild',
  APPEND_CHILD: 'appendChild',
  SET_TEXT: 'setText',
  SET_ATTRIBUTE: 'setAttribute',
  REMOVE_ATTRIBUTE: 'removeAttribute',
  SET_ATTRIBUTE_NS: 'setAttributeNS',
  REMOVE_ATTRIBUTE_NS: 'removeAttributeNS',
  SET_PROPERTY: 'setProperty',
  CLASS_NAME: 'className',
  STYLE: 'style',
  ADD_EVENT_LISTENER: 'addEventListener',
  REMOVE_EVENT_LISTENER: 'removeEventListener',
}

const jobDomOperatorList = []

let flushScheduled = false
let rafId = 0

const nextTickCbs = []

export function registerNextTickCb(cb) {
  nextTickCbs.push(cb)
}

export function flushNextTickCbs() {
  if (nextTickCbs.length) {
    const cbs = nextTickCbs.slice()
    nextTickCbs.length = 0
    for (let i = 0; i < cbs.length; i++) {
      cbs[i]()
    }
  }
}

export function queueDomOp(type, payload) {
  const record = payload || {}
  record.type = type
  jobDomOperatorList.push(record)
}

export function getPendingDomOpCount() {
  return jobDomOperatorList.length
}

function playDomOp(record) {
  switch (record.type) {
    case DomOpType.INSERT_BEFORE:
      record.parent.insertBefore(record.node, record.anchor)
      break
    case DomOpType.REMOVE_CHILD:
      record.parent.removeChild(record.child)
      break
    case DomOpType.APPEND_CHILD:
      record.parent.appendChild(record.child)
      break
    case DomOpType.SET_TEXT:
      record.node.textContent = record.text
      break
    case DomOpType.SET_ATTRIBUTE:
      record.el.setAttribute(record.name, record.value)
      break
    case DomOpType.REMOVE_ATTRIBUTE:
      record.el.removeAttribute(record.name)
      break
    case DomOpType.SET_ATTRIBUTE_NS:
      record.el.setAttributeNS(record.ns, record.name, record.value)
      break
    case DomOpType.REMOVE_ATTRIBUTE_NS:
      record.el.removeAttributeNS(record.ns, record.name)
      break
    case DomOpType.SET_PROPERTY:
      record.el[record.key] = record.value
      break
    case DomOpType.CLASS_NAME:
      record.el.className = record.value
      break
    case DomOpType.STYLE:
      record.el.style[record.property] = record.value
      break
    case DomOpType.ADD_EVENT_LISTENER:
      record.el.addEventListener(record.event, record.handler, record.options)
      break
    case DomOpType.REMOVE_EVENT_LISTENER:
      record.el.removeEventListener(
        record.event,
        record.handler,
        record.options,
      )
      break
  }
}

export function flushDomJobs() {
  if (flushScheduled) {
    flushScheduled = false
    if (rafId && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafId)
    }
    rafId = 0
  }

  const list = jobDomOperatorList
  const len = list.length
  for (let i = 0; i < len; i++) {
    playDomOp(list[i])
  }
  list.length = 0
  flushNextTickCbs()
}

export function scheduleDomFlush() {
  if (!flushScheduled) {
    flushScheduled = true
    if (typeof requestAnimationFrame !== 'undefined') {
      rafId = requestAnimationFrame(flushDomJobs)
    } else {
      setTimeout(flushDomJobs, 0)
    }
  }
}

export function runWithDomOps(fn) {
  fn()
  scheduleDomFlush()
}

export function runWithDomOpsSync(fn) {
  fn()
  flushDomJobs()
}
