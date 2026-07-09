<script setup lang="ts" vapor>
import { ref } from "vue";
import DemoCard from "../components/demo/DemoCard.vue";
import { HElementDemo } from "../components/demo/h/hElementDemo";
import { HReactivePropsDemo } from "../components/demo/h/hReactivePropsDemo";
import { HReactiveChildrenDemo } from "../components/demo/h/hReactiveChildrenDemo";
import { HComponentDemo } from "../components/demo/h/hComponentDemo";
import { HNamedSlotsDemo } from "../components/demo/h/hNamedSlotsDemo";
import { HFragmentDemo } from "../components/demo/h/hFragmentDemo";
import { HEventDemo } from "../components/demo/h/hEventDemo";
import { HDynamicTypeDemo } from "../components/demo/h/hDynamicTypeDemo";

const className = ref("h-demo-box h-demo-box--accent");
const message = ref("响应式文本");
const label = ref("父级 label");
const dynamicTag = ref<"div" | "section" | "article">("div");

const classOptions = [
  "h-demo-box h-demo-box--accent",
  "h-demo-box h-demo-box--warm",
  "h-demo-box h-demo-box--cool",
];

const tagOptions: Array<"div" | "section" | "article"> = ["div", "section", "article"];

function cycleClass() {
  const idx = classOptions.indexOf(className.value);
  className.value = classOptions[(idx + 1) % classOptions.length]!;
}

function cycleTag() {
  const idx = tagOptions.indexOf(dynamicTag.value);
  dynamicTag.value = tagOptions[(idx + 1) % tagOptions.length]!;
}
</script>

<template>
  <div class="view-page">
    <h1>h() 函数</h1>
    <p class="view-desc">
      Vapor-native <code>h()</code>：签名对齐 Vue <code>h</code>，返回可挂载的
      <strong>Block</strong>（非 VNode）。响应式需用 getter / ref 驱动 props 与 children。
    </p>

    <section class="h-intro">
      <p>
        普通快照值（如 <code>h('div', { class: 'a' })</code>）只渲染一次，与直接调用
        <code>createPlainElement</code> 一致。动态更新请使用
        <code>{ class: () => cls.value }</code>、<code>{ class: cls }</code> 或
        <code>() => msg.value</code> 等形式。
      </p>
      <p class="h-intro__note">
        不支持 VDOM 组件与 vue-router；下方示例均通过
        <code>defineVaporComponent</code> + <code>h()</code> 程序化渲染。
      </p>
    </section>

    <DemoCard
      title="基础元素与参数重载"
      :apis="['h(type)', 'h(type, props)', 'h(type, children)', 'h(type, props, children)']"
      description="静态标签、props、文本子节点重载与嵌套 children 数组。"
    >
      <component :is="HElementDemo" />
    </DemoCard>

    <DemoCard
      title="响应式 props"
      :apis="['getter props', 'ref props']"
      description="class 通过 getter 绑定 props.className，父级 ref 变化时 DOM 同步更新。"
      expected="切换样式后，方块背景色与文案中的 class 名应随之变化。"
    >
      <div class="demo-controls">
        <button type="button" class="demo-btn" @click="cycleClass">切换 class</button>
        <span class="demo-result">当前：{{ className }}</span>
      </div>
      <component :is="HReactivePropsDemo" :class-name="className" />
    </DemoCard>

    <DemoCard
      title="响应式 children"
      :apis="['() => text', 'ref children']"
      description="default slot 使用 getter：h('div', null, () => props.message)。"
      expected="编辑 message 后，方块内文本应实时更新。"
    >
      <div class="demo-controls">
        <input v-model="message" type="text" class="demo-input" placeholder="编辑 message" />
      </div>
      <component :is="HReactiveChildrenDemo" :message="message" />
    </DemoCard>

    <DemoCard
      title="Vapor 子组件"
      :apis="['h(Comp, props, slot)', 'defineVaporComponent']"
      description="h(Child, { label: () => props.label }, () => h('em', …)) 组合子组件与默认插槽。"
      expected="修改 label 后，子组件 strong 文本应更新，em 插槽内容保留。"
    >
      <div class="demo-controls">
        <input v-model="label" type="text" class="demo-input" placeholder="编辑 label" />
      </div>
      <component :is="HComponentDemo" :label="label" />
    </DemoCard>

    <DemoCard
      title="具名插槽对象"
      :apis="['h(Comp, null, { header, default })']"
      description="第三参为插槽对象时，header / default 分别渲染到具名区域。"
    >
      <component :is="HNamedSlotsDemo" />
    </DemoCard>

    <DemoCard
      title="Fragment 多根"
      :apis="['Fragment', 'h(Fragment, null, [a, b])']"
      description="h(Fragment, …) 返回 Block[]，无需包裹元素即可并列多根。"
    >
      <component :is="HFragmentDemo" />
    </DemoCard>

    <DemoCard
      title="事件处理"
      :apis="['onClick', 'onXxx']"
      description="onXxx 事件保持函数引用；按钮文案通过 getter children 响应 count。"
      expected="点击按钮后计数递增，按钮文字与下方 demo-result 同步更新。"
    >
      <component :is="HEventDemo" />
    </DemoCard>

    <DemoCard
      title="动态 type"
      :apis="['h(tagRef, props, children)', 'createDynamicComponent']"
      description="type 为 ref 时走动态组件路径，可在 div / section / article 间切换。"
      expected="切换标签后，DOM 节点名与文案中的标签名应变化，id 保持不变。"
    >
      <div class="demo-controls">
        <button type="button" class="demo-btn" @click="cycleTag">切换标签</button>
        <span class="demo-result">当前：&lt;{{ dynamicTag }}&gt;</span>
      </div>
      <component :is="HDynamicTypeDemo" :tag="dynamicTag" />
    </DemoCard>
  </div>
</template>

<style scoped>
.h-intro {
  padding: 14px 18px;
  border-radius: 8px;
  background: var(--code-bg);
  border: 1px solid var(--border);
  margin-bottom: 32px;
}

.h-intro p {
  margin: 0 0 10px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--text);
}

.h-intro p:last-child {
  margin-bottom: 0;
}

.h-intro__note {
  font-size: 14px;
  color: var(--text);
  padding-top: 8px;
  border-top: 1px dashed var(--border);
}

:deep(.h-demo-stack) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:deep(.h-demo-box) {
  padding: 10px 14px;
  border-radius: 6px;
  background: var(--code-bg);
  border: 1px solid var(--border);
  font-size: 14px;
  line-height: 1.5;
}

:deep(.h-demo-box--accent) {
  background: #dbeafe;
  border-color: #93c5fd;
  color: #1e3a8a;
}

:deep(.h-demo-box--warm) {
  background: #fef3c7;
  border-color: #fcd34d;
  color: #78350f;
}

:deep(.h-demo-box--cool) {
  background: #d1fae5;
  border-color: #6ee7b7;
  color: #064e3b;
}

:deep(.h-demo-child) {
  padding: 10px 14px;
  border-radius: 6px;
  background: var(--code-bg);
  border: 1px solid var(--border);
  font-size: 14px;
}

:deep(.h-demo-slots) {
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

:deep(.h-demo-slots__header) {
  padding: 8px 12px;
  background: #ede9fe;
  color: #5b21b6;
  font-size: 13px;
  font-family: var(--mono);
}

:deep(.h-demo-slots__body) {
  padding: 10px 12px;
  background: var(--code-bg);
  font-size: 14px;
}

:deep(.h-demo-fragment-item) {
  display: inline-block;
  margin-right: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--code-bg);
  border: 1px solid var(--border);
  font-size: 13px;
  font-family: var(--mono);
}
</style>
