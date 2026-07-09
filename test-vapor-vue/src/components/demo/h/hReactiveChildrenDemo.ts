import { defineVaporComponent, h } from 'vue'

/** 响应式 children：default slot getter 驱动文本更新 */
export const HReactiveChildrenDemo = defineVaporComponent({
  props: {
    message: { type: String, required: true },
  },
  setup(props) {
    return h('div', { class: 'h-demo-box' }, () => props.message)
  },
})
