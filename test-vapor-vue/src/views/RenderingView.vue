<script setup lang="ts" vapor>
import { computed, ref, useTemplateRef } from "vue";
import DemoCard from "../components/demo/DemoCard.vue";
import ChildRenderA from "../components/demo/ChildRenderA.vue";
import ChildRenderB from "../components/demo/ChildRenderB.vue";

const message = ref("Hello Vapor");
const htmlContent = ref("<em>v-html 渲染</em>");
const counter = ref(0);
const memoDep = ref(0);
const showA = ref(true);

const components = { A: ChildRenderA, B: ChildRenderB };
const currentComp = computed(() => (showA.value ? components.A : components.B));

const inputRef = useTemplateRef<HTMLInputElement>("focusInput");

const memoItems = computed(() =>
  Array.from({ length: 8 }, (_, i) => ({
    id: i,
    label: `Item ${i}`,
    highlight: i % 3 === memoDep.value % 3,
  })),
);

function focusInput() {
  inputRef.value?.focus();
}
</script>

<template>
  <div class="view-page">
    <h1>渲染</h1>
    <p class="view-desc">
      插值、v-text、v-html、多根节点、动态组件、v-once、v-memo、useTemplateRef
    </p>

    <DemoCard
      title="文本插值与 v-text / v-html"
      :apis="['{{ }}', 'v-text', 'v-html']"
      description="mustache 插值与指令形式输出文本 / HTML。"
    >
      <div class="demo-controls">
        <input v-model="message" type="text" class="demo-input" placeholder="编辑 message" />
        <input v-model="htmlContent" type="text" class="demo-input" placeholder="编辑 HTML" />
      </div>
      <div class="demo-result">插值：{{ message }}</div>
      <div class="demo-result">v-text：<span v-text="message" /></div>
      <div class="demo-result">v-html：<span v-html="htmlContent" /></div>
    </DemoCard>

    <DemoCard
      title="多根节点"
      :apis="['Fragment']"
      description="模板含多个并列根节点，无需包裹元素。"
    >
      <p class="style-demo-note">根节点 1：段落文本</p>
      <p class="style-demo-note">根节点 2：另一段并列内容</p>
    </DemoCard>

    <DemoCard
      title="动态组件 :is"
      :apis="[':is', 'resolveDynamicComponent']"
      description="通过 :is 在两个 Vapor 子组件间切换。"
      expected="点击切换后，边框颜色与标题在 A / B 之间变化。"
    >
      <div class="demo-controls">
        <button type="button" class="demo-btn" @click="showA = !showA">切换组件</button>
        <span class="demo-result">当前：{{ showA ? "A" : "B" }}</span>
      </div>
      <component :is="currentComp" />
    </DemoCard>

    <DemoCard
      title="v-once"
      :apis="['v-once']"
      description="v-once 区块仅在首次渲染时求值，后续不再更新。"
      expected="增加 counter 后，下方「一次性快照」中的数字保持不变。"
    >
      <div class="demo-controls">
        <button type="button" class="demo-btn" @click="counter++">
          counter++（{{ counter }}）
        </button>
      </div>
      <div class="demo-result">实时 counter：{{ counter }}</div>
      <div v-once class="demo-result">一次性快照 counter：{{ counter }}</div>
    </DemoCard>

    <DemoCard
      title="v-memo"
      :apis="['v-memo']"
      description="依赖项不变时跳过子树更新，观察高亮项随 memoDep 变化。"
      expected="切换 memo 依赖时，匹配 id % 3 的项背景高亮；其余项 DOM 复用。"
    >
      <div class="demo-controls">
        <button type="button" class="demo-btn" @click="memoDep++">
          切换 memo 依赖（{{ memoDep }}）
        </button>
      </div>
      <ul class="memo-list">
        <li
          v-for="item in memoItems"
          :key="item.id"
          v-memo="[memoDep]"
          class="memo-list__item"
          :class="{ 'memo-list__item--highlight': item.highlight }"
        >
          {{ item.label }} — highlight={{ item.highlight }}
        </li>
      </ul>
    </DemoCard>

    <DemoCard
      title="useTemplateRef"
      :apis="['useTemplateRef', 'ref']"
      description="组合式 API 获取模板 ref 并聚焦输入框。"
    >
      <div class="demo-controls">
        <input ref="focusInput" type="text" class="demo-input" placeholder="点击下方按钮聚焦" />
        <button type="button" class="demo-btn" @click="focusInput">聚焦输入框</button>
      </div>
    </DemoCard>
  </div>
</template>

<style scoped>
.memo-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.memo-list__item {
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--code-bg);
  font-family: var(--mono);
  font-size: 13px;
  transition: background 0.2s;
}

.memo-list__item--highlight {
  background: #fef08a;
  color: #713f12;
}

.style-demo-note {
  margin: 0;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--code-bg);
  font-size: 14px;
}
</style>
