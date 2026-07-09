<script setup lang="ts" vapor>
const version = "3.6.0-beta.17";
const compilerDirectives =
  "bind, cloak, else-if, else, for, html, if, model, on, once, pre, show, slot, text, memo";

const sections = [
  {
    id: "rendering",
    label: "渲染",
    apis: ["{{ }}", "v-text", "v-html", "Fragment", ":is", "v-once", "v-memo", "useTemplateRef"],
    status: "supported" as const,
  },
  {
    id: "directives",
    label: "指令",
    apis: ["v-if/else", "v-show", "v-for", "v-model", "v-on", "自定义指令"],
    status: "supported" as const,
  },
  {
    id: "style",
    label: "样式",
    apis: [":class", ":style", "scoped", ":deep()", "v-bind() CSS", "useCssModule"],
    status: "supported" as const,
  },
  {
    id: "component",
    label: "组件 API",
    apis: [
      "defineProps",
      "defineEmits",
      "defineExpose",
      "defineSlots",
      "defineModel",
      "$attrs",
      "defineAsyncComponent",
    ],
    status: "supported" as const,
  },
  {
    id: "builtin",
    label: "内置组件",
    apis: ["Transition", "TransitionGroup", "KeepAlive", "Teleport"],
    status: "supported" as const,
  },
  {
    id: "composition",
    label: "组合式 API",
    apis: [
      "ref/reactive",
      "computed",
      "watch",
      "provide/inject",
      "useAttrs/useSlots/useId",
      "effectScope/getCurrentScope/onScopeDispose",
    ],
    status: "supported" as const,
  },
  {
    id: "lifecycle",
    label: "生命周期",
    apis: [
      "onBeforeMount",
      "onMounted",
      "onBeforeUpdate",
      "onUpdated",
      "onBeforeUnmount",
      "onUnmounted",
      "onActivated",
      "onDeactivated",
      "onErrorCaptured",
    ],
    status: "supported" as const,
  },
];

const unsupported = [
  { api: "Suspense", reason: "pure-vapor 未导出，运行时会 import 失败" },
  { api: "Options API", reason: "仅支持 Composition API + <script setup vapor>" },
  { api: "getCurrentInstance()", reason: "在 Vapor 模式下返回 null" },
  { api: "h() render function", reason: "无 VDOM 运行时" },
  { api: "SSR", reason: "当前版本不支持服务端渲染" },
  { api: "vaporInteropPlugin", reason: "VDOM 互操作为空实现" },
  { api: "vue-router", reason: "依赖 VDOM API，与本项目不兼容" },
  { api: "@vue:xxx 元素生命周期", reason: "元素级 Options 生命周期不可用" },
];
</script>

<template>
  <div class="view-page">
    <h1>总览</h1>
    <p class="view-desc">
      pure-vapor@{{ version }} API 完整性测试工程。通过侧边栏切换各区块，目视验证编译与运行时行为。
    </p>

    <section class="overview-meta">
      <div class="overview-meta__item">
        <span class="overview-meta__label">运行时</span>
        <code>pure-vapor@{{ version }}</code>
      </div>
      <div class="overview-meta__item">
        <span class="overview-meta__label">编译器内置指令</span>
        <code class="overview-meta__code-block">{{ compilerDirectives }}</code>
      </div>
      <div class="overview-meta__item">
        <span class="overview-meta__label">脚本模式</span>
        <code>&lt;script setup lang="ts" vapor&gt;</code>
      </div>
    </section>

    <h2 class="overview-section-title">能力矩阵</h2>
    <div class="overview-matrix">
      <div v-for="section in sections" :key="section.id" class="overview-matrix__card">
        <div class="overview-matrix__header">
          <span class="overview-matrix__label">{{ section.label }}</span>
          <span class="overview-badge overview-badge--ok">支持</span>
        </div>
        <div class="overview-matrix__tags">
          <code v-for="api in section.apis" :key="api" class="overview-matrix__tag">{{ api }}</code>
        </div>
      </div>
    </div>

    <h2 class="overview-section-title">不支持项</h2>
    <p class="overview-note">
      以下 API 在 pure-vapor 中不可用或行为不同，详见「限制说明」页，本工程不编写可运行示例。
    </p>
    <table class="overview-table">
      <thead>
        <tr>
          <th>API</th>
          <th>原因</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in unsupported" :key="item.api">
          <td>
            <code>{{ item.api }}</code>
          </td>
          <td>{{ item.reason }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.overview-meta {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--code-bg);
  margin-bottom: 32px;
}

.overview-meta__item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.overview-meta__label {
  font-size: 12px;
  font-weight: 500;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.overview-meta__code-block {
  word-break: break-all;
  line-height: 1.5;
}

.overview-section-title {
  font-size: 20px;
  margin: 0 0 16px;
  color: var(--text-h);
}

.overview-note {
  margin: 0 0 16px;
  font-size: 15px;
  color: var(--text);
  line-height: 1.5;
}

.overview-matrix {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.overview-matrix__card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px 16px;
  background: var(--bg);
}

.overview-matrix__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.overview-matrix__label {
  font-weight: 500;
  color: var(--text-h);
}

.overview-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.overview-badge--ok {
  background: #dcfce7;
  color: #166534;
}

.overview-matrix__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.overview-matrix__tag {
  font-size: 12px;
  padding: 2px 6px;
}

.overview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.overview-table th,
.overview-table td {
  padding: 10px 14px;
  border: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}

.overview-table th {
  background: var(--code-bg);
  font-weight: 500;
  color: var(--text-h);
}

.overview-table td:first-child {
  white-space: nowrap;
  width: 200px;
}
</style>
