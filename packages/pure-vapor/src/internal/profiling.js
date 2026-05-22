import { formatComponentName } from './component.js'

export function startMeasure(instance, type) {
  if (instance.appContext && instance.appContext.config.performance) {
    perf.mark(`vue-${type}-${instance.uid}`)
  }
}

export function endMeasure(instance, type) {
  if (instance.appContext && instance.appContext.config.performance) {
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

// window.performance 除IE外都支持
let supported = true
let perf = window.performance
