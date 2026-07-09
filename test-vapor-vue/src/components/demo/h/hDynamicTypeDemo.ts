import { defineVaporComponent, h, toRef } from 'vue'

/** 动态 type：h(tagRef, props, children) 切换标签名 */
export const HDynamicTypeDemo = defineVaporComponent({
  props: {
    tag: { type: String, required: true },
  },
  setup(props) {
    const tag = toRef(props, 'tag')
    return h(
      tag,
      { id: 'h-dynamic-type', class: 'h-demo-box' },
      () => `<${props.tag}> 动态标签`,
    )
  },
})
