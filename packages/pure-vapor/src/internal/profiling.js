import { formatComponentName } from './component.js'

export function startMeasure(instance, type) {
  if (
    instance.appContext &&
    instance.appContext.config.performance &&
    isSupported()
  ) {
    perf.mark(`vue-${type}-${instance.uid}`)
  }
}

export function endMeasure(instance, type) {
  if (
    instance.appContext &&
    instance.appContext.config.performance &&
    isSupported()
  ) {
    const startTag = `vue-${type}-${instance.uid}`
    const endTag = startTag + `:end`
    const measureName = `<${formatComponentName(instance, instance.type)}> ${type}`
    perf.mark(endTag)
    perf.measure(measureName, startTag, endTag)
    perf.clearMeasures(measureName)
    perf.clearMarks(startTag)
    perf.clearMarks(endTag)
  }
}

let supported
let perf

function isSupported() {
  if (supported === undefined) {
    supported = typeof window !== 'undefined' && window.performance != null
    perf = supported ? window.performance : null
  }
  return supported
}
