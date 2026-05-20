import {
  createAsyncComponentContext,
  useAsyncComponentState,
} from '../internal/asyncComponent.js'
import { markAsyncBoundary } from '../internal/useId.js'
import { ErrorCodes, handleError } from '../internal/errorHandling.js'
import { currentInstance, setCurrentInstance } from '../internal/instance.js'
import { defineVaporComponent } from './apiDefineComponent.js'
import { createComponent } from './component.js'
import { renderEffect } from './renderEffect.js'
import { DynamicFragment } from './fragment.js'

export function defineVaporAsyncComponent(source) {
  const {
    load,
    getResolvedComp,
    setPendingRequest,
    source: { loadingComponent, errorComponent, delay, timeout },
  } = createAsyncComponentContext(source)

  return defineVaporComponent({
    name: 'VaporAsyncComponentWrapper',

    __asyncLoader: load,

    get __asyncResolved() {
      return getResolvedComp()
    },

    setup() {
      const instance = currentInstance
      markAsyncBoundary(instance)

      const frag = __DEV__
        ? new DynamicFragment('async component')
        : new DynamicFragment()

      let resolvedComp = getResolvedComp()
      if (resolvedComp) {
        frag.update(() => createInnerComp(resolvedComp, instance))
        return frag
      }

      const onError = err => {
        setPendingRequest(null)
        handleError(
          err,
          instance,
          ErrorCodes.ASYNC_COMPONENT_LOADER,
          !errorComponent,
        )
      }

      const { loaded, error, delayed } = useAsyncComponentState(
        delay,
        timeout,
        onError,
      )

      load()
        .then(() => {
          loaded.value = true
        })
        .catch(err => {
          onError(err)
          error.value = err
        })

      renderEffect(() => {
        resolvedComp = getResolvedComp()
        let render
        if (loaded.value && resolvedComp) {
          render = () => createInnerComp(resolvedComp, instance)
        } else if (error.value && errorComponent) {
          render = () =>
            createComponent(errorComponent, { error: () => error.value })
        } else if (loadingComponent && !delayed.value) {
          render = () => createComponent(loadingComponent)
        }

        frag.update(render)
      })

      return frag
    },
  })
}

function createInnerComp(comp, parent, rawProps, rawSlots) {
  if (rawProps == null) rawProps = parent.rawProps
  if (rawSlots == null) rawSlots = parent.rawSlots
  const prevInstance = setCurrentInstance(parent)
  try {
    return createComponent(
      comp,
      rawProps,
      rawSlots,
      undefined,
      undefined,
      parent.appContext,
    )
  } finally {
    setCurrentInstance(...prevInstance)
  }
}
