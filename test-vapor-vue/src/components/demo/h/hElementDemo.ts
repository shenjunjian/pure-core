import { defineVaporComponent, h } from 'vue'

/** 静态元素：参数重载、props、嵌套 children */
export const HElementDemo = defineVaporComponent({
  setup() {
    return h('div', { class: 'h-demo-stack' }, [
      h(
        'p',
        { class: 'demo-result' },
        'h("div", "text") — 第二参视为 children',
      ),
      h('div', { class: 'h-demo-box' }, '直接文本子节点'),
      h('p', { class: 'demo-result' }, 'h("div", { id, class }) — 静态 props'),
      h('div', { id: 'h-el-static', class: 'h-demo-box h-demo-box--accent' }),
      h(
        'p',
        { class: 'demo-result' },
        "h('div', null, [child, child]) — 嵌套数组",
      ),
      h('div', { class: 'h-demo-box' }, [
        h('span', null, '子节点 A'),
        h('span', null, ' · '),
        h('span', null, '子节点 B'),
      ]),
    ])
  },
})
