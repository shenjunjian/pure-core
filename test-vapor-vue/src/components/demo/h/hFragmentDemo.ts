import { Fragment, defineVaporComponent, h } from 'vue'

/** Fragment 多根：h(Fragment, null, [a, b]) 返回 Block[] */
export const HFragmentDemo = defineVaporComponent({
  setup() {
    return h(Fragment, null, [
      h('span', { class: 'h-demo-fragment-item' }, 'Fragment 根 1'),
      h('span', { class: 'h-demo-fragment-item' }, 'Fragment 根 2'),
    ])
  },
})
