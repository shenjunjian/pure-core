import { defineVaporComponent, h, ref } from 'vue'

/** 事件处理：onClick 保持函数引用，不包成 getter */
export const HEventDemo = defineVaporComponent({
  setup() {
    const count = ref(0)

    return h('div', { class: 'h-demo-stack' }, [
      h(
        'button',
        {
          type: 'button',
          class: 'demo-btn',
          onClick: () => {
            count.value++
          },
        },
        () => `点击 +1（${count.value}）`,
      ),
      h('div', { class: 'demo-result' }, () => `count = ${count.value}`),
    ])
  },
})
