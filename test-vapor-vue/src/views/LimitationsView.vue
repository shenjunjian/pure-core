<script setup lang="ts" vapor>
const limitations = [
  {
    api: "Suspense",
    category: "内置组件",
    reason: "pure-vapor 未导出 Suspense。模板中使用可能通过编译，但运行时会因 import 失败而报错。",
    workaround: "使用条件渲染或异步组件手动管理加载状态。",
  },
  {
    api: "Options API",
    category: "组件写法",
    reason:
      "仅支持 Composition API 与 <script setup vapor>。data、methods、computed 选项等不可用。",
    workaround: "使用 ref、reactive、computed 与组合式函数替代。",
  },
  {
    api: "getCurrentInstance()",
    category: "组合式 API",
    reason: "在 Vapor 模式下返回 null，无法获取当前组件实例。",
    workaround: "通过 props / emit / provide-inject 显式传递上下文。",
  },
  {
    api: "h() render function",
    category: "渲染",
    reason: "pure-vapor 无 VDOM 运行时，不支持渲染函数与手动 h() 创建 VNode。",
    workaround: "使用模板语法或 Vapor 编译输出。",
  },
  {
    api: "SSR",
    category: "运行时",
    reason: "当前版本不支持服务端渲染。",
    workaround: "仅客户端挂载；SSR 需等待官方支持。",
  },
  {
    api: "vaporInteropPlugin",
    category: "互操作",
    reason: "VDOM 互操作插件为空实现，无法在 Vapor 与 VDOM 组件间混合渲染。",
    workaround: "工程内全部使用 Vapor 组件，不引入 VDOM 依赖库（如 vue-router）。",
  },
  {
    api: "vue-router",
    category: "生态",
    reason: "vue-router 依赖 h() 等 VDOM API，与 pure-vapor 不兼容。",
    workaround: "本工程使用 ref + <component :is> 单页切换，无需路由。",
  },
  {
    api: "@vue:xxx 元素生命周期",
    category: "DOM 事件",
    reason: "元素上的 @vue:mounted 等 Options 风格生命周期钩子不可用。",
    workaround: "在组件内使用 onMounted 等组合式钩子。",
  },
];

const compilerNotes = [
  "编译器内置指令：bind, cloak, else-if, else, for, html, if, model, on, once, pre, show, slot, text, memo",
  "自定义指令需使用 Vapor 接口（watchEffect + cleanup），见「指令」页示例",
  '所有示例组件使用 <script setup lang="ts" vapor> 编译模式',
];
</script>

<template>
  <div class="view-page">
    <h1>限制说明</h1>
    <p class="view-desc">
      pure-vapor 已知不支持或行为不同的 API。本页为只读说明，不编写可运行示例，避免运行时错误。
    </p>

    <section class="limitations-intro">
      <p>
        以下清单引用 pure-vapor README 排除表。在测试新 API 前，请先确认是否属于支持范围；
        若编译通过但运行失败，请对照此页排查。
      </p>
    </section>

    <div class="limitations-list">
      <article v-for="item in limitations" :key="item.api" class="limitations-card">
        <header class="limitations-card__header">
          <code class="limitations-card__api">{{ item.api }}</code>
          <span class="limitations-card__category">{{ item.category }}</span>
        </header>
        <p class="limitations-card__reason">{{ item.reason }}</p>
        <p class="limitations-card__workaround">
          <span class="limitations-card__label">替代方案</span>
          {{ item.workaround }}
        </p>
      </article>
    </div>

    <h2 class="limitations-section-title">编译器说明</h2>
    <ul class="limitations-notes">
      <li v-for="(note, index) in compilerNotes" :key="index">{{ note }}</li>
    </ul>
  </div>
</template>

<style scoped>
.limitations-intro {
  padding: 14px 18px;
  border-radius: 8px;
  background: var(--code-bg);
  border: 1px solid var(--border);
  margin-bottom: 24px;
}

.limitations-intro p {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--text);
}

.limitations-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 32px;
}

.limitations-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px 20px;
  background: var(--bg);
}

.limitations-card__header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.limitations-card__api {
  font-size: 15px;
  font-weight: 500;
  color: #991b1b;
  background: #fef2f2;
  padding: 2px 8px;
  border-radius: 4px;
}

.limitations-card__category {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--code-bg);
  color: var(--text);
}

.limitations-card__reason {
  margin: 0 0 10px;
  font-size: 15px;
  line-height: 1.5;
  color: var(--text-h);
}

.limitations-card__workaround {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text);
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--accent-bg);
  border-left: 3px solid var(--accent);
}

.limitations-card__label {
  display: block;
  font-size: 11px;
  font-weight: 500;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.limitations-section-title {
  font-size: 20px;
  margin: 0 0 12px;
  color: var(--text-h);
}

.limitations-notes {
  margin: 0;
  padding-left: 20px;
  font-size: 15px;
  line-height: 1.8;
  color: var(--text);
}
</style>
