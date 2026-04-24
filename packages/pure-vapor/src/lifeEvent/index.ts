import type { App, AppContext } from '../types'
import type { VaporComponentInstance } from '../component'

type AppEventContext = {
  app: App
  appContext: AppContext
  component: App['_component']
  props: App['_props']
  container?: App['_container'] | null
  instance?: VaporComponentInstance | null
  isMounted: boolean
}

type ComponentEventContext = {
  instance: VaporComponentInstance
  appContext: AppContext
  parent: VaporComponentInstance | null
  parentNode?: ParentNode
  anchor?: Node | null
  isMounted: boolean
  isUnmounted: boolean
}

type UpdateEventContext = {
  instance: VaporComponentInstance
  effect: unknown
  isUpdating: boolean
}

type CbMap = {
  // ******* 应用生命周期 *******
  beforeCreateApp: Array<() => void>
  createdApp: Array<(ctx: AppEventContext) => void | Promise<void>>
  beforeMountApp: Array<(ctx: AppEventContext) => void | Promise<void>>
  mountedApp: Array<(ctx: AppEventContext) => void | Promise<void>>
  beforeUnmountApp: Array<(ctx: AppEventContext) => void | Promise<void>>
  unmountedApp: Array<(ctx: AppEventContext) => void | Promise<void>>

  // ******* 组件生命周期 *******
  beforeCreateComponent: Array<
    (ctx: {
      component: VaporComponentInstance['type']
      appContext?: AppContext
      parent: VaporComponentInstance | null
      rawProps?: any
      rawSlots?: any
    }) => void | Promise<void>
  >
  createdComponent: Array<(ctx: ComponentEventContext) => void | Promise<void>>
  beforeMountComponent: Array<
    (ctx: ComponentEventContext) => void | Promise<void>
  >
  mountedComponent: Array<(ctx: ComponentEventContext) => void | Promise<void>>
  beforeUpdateComponent: Array<
    (ctx: UpdateEventContext) => void | Promise<void>
  >
  updatedComponent: Array<(ctx: UpdateEventContext) => void | Promise<void>>
  beforeUnmountComponent: Array<
    (ctx: ComponentEventContext) => void | Promise<void>
  >
  unmountedComponent: Array<
    (ctx: ComponentEventContext) => void | Promise<void>
  >
}

/** 生命周期存储集合 */
const cbMap: CbMap = {
  // 进入 createVaporApp 后立即触发，上下文尚未创建。
  beforeCreateApp: [],
  // app 对象构建完成后触发，ctx: { app, appContext, component, props, isMounted }。
  createdApp: [],
  // app.mount 流程中、createComponent 前触发，ctx 含 container。
  beforeMountApp: [],
  // 根组件挂载完成后触发，ctx 含 instance/container/isMounted。
  mountedApp: [],
  // app.unmount 流程中、unmountComponent 前触发，ctx 含 instance/container。
  beforeUnmountApp: [],
  // app 卸载收尾后触发，ctx 含 instance=null/isMounted=false。
  unmountedApp: [],

  // createComponent 入口触发，ctx: { component, appContext, parent, rawProps, rawSlots }。
  beforeCreateComponent: [],
  // setupComponent 完成后触发，ctx: { instance, appContext, parent, isMounted, isUnmounted }。
  createdComponent: [],
  // mountComponent 内 insert 前触发，ctx 含 parentNode/anchor。
  beforeMountComponent: [],
  // mountComponent 内 insert 后、isMounted=true 后触发。
  mountedComponent: [],
  // RenderEffect 命中更新分支时触发，ctx: { instance, effect, isUpdating }。
  beforeUpdateComponent: [],
  // 组件更新 render + updated hook 后触发，ctx: { instance, effect, isUpdating }。
  updatedComponent: [],
  // unmountComponent 首次有效卸载时、scope.stop 前触发。
  beforeUnmountComponent: [],
  // 组件卸载（含可用时的 DOM remove）完成后触发。
  unmountedComponent: [],
}

// **************** 生命周期管理 ****************

/** 主流程中派发一个事件 */
export const lifeDispatch = async <T extends keyof CbMap>(
  type: T,
  ...args: Parameters<CbMap[T][number]>
): Promise<void> => {
  for (const cb of cbMap[type]) await cb(...args)
}

/** 注册一个监听事件 */
export const lifeListen = <T extends keyof CbMap>(
  type: T,
  cb: CbMap[T][number],
): number => cbMap[type].push(cb)
