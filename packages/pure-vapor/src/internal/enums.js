/** 钩子在实例上的属性， 只有用户定义了某个钩子，才会产生这个属性
 * eg.  instance.bm = []
 */
export const LifecycleHooks = {
  BEFORE_MOUNT: 'bm',
  MOUNTED: 'm', // queuePostFlushCb
  BEFORE_UPDATE: 'bu',
  UPDATED: 'u',
  BEFORE_UNMOUNT: 'bum',
  UNMOUNTED: 'um', // queuePostFlushCb
  DEACTIVATED: 'da',
  ACTIVATED: 'a',
  RENDER_TRIGGERED: 'rtg',
  RENDER_TRACKED: 'rtc',
  ERROR_CAPTURED: 'ec',
  SERVER_PREFETCH: 'sp',
}
