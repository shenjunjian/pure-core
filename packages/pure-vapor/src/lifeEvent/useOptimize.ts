// 一些边角的优化

import { lifeListen } from '.'
import { optimizePropertyLookup } from '../dom/prop'

export function useOptimize(): void {
  lifeListen('beforeCreateApp', () => {
    optimizePropertyLookup()
  })
}
