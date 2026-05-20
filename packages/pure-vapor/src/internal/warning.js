import {
  isFunction,
  isRef,
  isString,
  setActiveSub,
  toRaw,
} from '@vue/reactivity'
import { ErrorCodes, callWithErrorHandling } from './errorHandling.js'
import { formatComponentName } from './component.js'

const stack = []

export function pushWarningContext(ctx) {
  stack.push(ctx)
}

export function popWarningContext() {
  stack.pop()
}

let isWarning = false

export function warn(msg, ...args) {
  if (isWarning) return
  isWarning = true

  const prevSub = setActiveSub()

  const entry = stack.length ? stack[stack.length - 1] : null
  const instance = entry
  const appWarnHandler =
    instance && instance.appContext && instance.appContext.config.warnHandler
  const trace = getComponentTrace()

  if (appWarnHandler) {
    callWithErrorHandling(
      appWarnHandler,
      instance,
      ErrorCodes.APP_WARN_HANDLER,
      [
        msg +
          args
            .map(a => {
              const toString = a.toString
              return toString == null ? JSON.stringify(a) : toString.call(a)
            })
            .join(''),
        (instance && instance.proxy) || instance,
        trace
          .map(({ ctx }) => `at <${formatComponentName(instance, ctx.type)}>`)
          .join('\n'),
        trace,
      ],
    )
  } else {
    const warnArgs = [`[Vue warn]: ${msg}`, ...args]
    if (trace.length && !__TEST__) {
      warnArgs.push(`\n`, ...formatTrace(trace))
    }
    console.warn(...warnArgs)
  }

  setActiveSub(prevSub)
  isWarning = false
}

function getComponentTrace() {
  let currentCtx = stack.length ? stack[stack.length - 1] : null
  if (!currentCtx) {
    return []
  }

  const normalizedStack = []

  while (currentCtx) {
    const last = normalizedStack[0]
    if (last && last.ctx === currentCtx) {
      last.recurseCount++
    } else {
      normalizedStack.push({
        ctx: currentCtx,
        recurseCount: 0,
      })
    }
    currentCtx = currentCtx.parent
  }

  return normalizedStack
}

function formatTrace(trace) {
  const logs = []
  trace.forEach((entry, i) => {
    logs.push(...(i === 0 ? [] : [`\n`]), ...formatTraceEntry(entry))
  })
  return logs
}

function formatTraceEntry({ ctx, recurseCount }) {
  const postfix =
    recurseCount > 0 ? `... (${recurseCount} recursive calls)` : ``
  const isRoot = ctx ? ctx.parent == null : false
  const open = ` at <${formatComponentName(ctx, ctx.type, isRoot)}`
  const close = `>` + postfix
  return ctx.props ? [open, ...formatProps(ctx.props), close] : [open + close]
}

function formatProps(props) {
  const res = []
  const keys = Object.keys(props)
  keys.slice(0, 3).forEach(key => {
    res.push(...formatProp(key, props[key]))
  })
  if (keys.length > 3) {
    res.push(` ...`)
  }
  return res
}

function formatProp(key, value, raw) {
  if (isString(value)) {
    value = JSON.stringify(value)
    return raw ? value : [`${key}=${value}`]
  } else if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value == null
  ) {
    return raw ? value : [`${key}=${value}`]
  } else if (isRef(value)) {
    value = formatProp(key, toRaw(value.value), true)
    return raw ? value : [`${key}=Ref<`, value, `>`]
  } else if (isFunction(value)) {
    return [`${key}=fn${value.name ? `<${value.name}>` : ``}`]
  } else {
    value = toRaw(value)
    return raw ? value : [`${key}=`, value]
  }
}
