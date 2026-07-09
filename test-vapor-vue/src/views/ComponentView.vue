<script setup lang="ts" vapor>
import { defineAsyncComponent, ref, useTemplateRef } from "vue";
import DemoCard from "../components/demo/DemoCard.vue";
import EventLog from "../components/demo/EventLog.vue";
import ChildProps from "../components/demo/ChildProps.vue";
import ChildEmit from "../components/demo/ChildEmit.vue";
import ChildExpose from "../components/demo/ChildExpose.vue";
import ChildSlots from "../components/demo/ChildSlots.vue";
import ChildModel from "../components/demo/ChildModel.vue";
import ChildAttrs from "../components/demo/ChildAttrs.vue";

const propsLabel = ref("自定义标签");
const propsCount = ref(3);
const propsActive = ref(true);

const emitLogs = ref<string[]>([]);

function onEmitAction(message: string) {
  emitLogs.value.unshift(`action: ${message}`);
  if (emitLogs.value.length > 8) emitLogs.value.length = 8;
}

function onEmitIncrement() {
  emitLogs.value.unshift("increment");
  if (emitLogs.value.length > 8) emitLogs.value.length = 8;
}

function clearEmitLogs() {
  emitLogs.value = [];
}

const exposeRef = useTemplateRef<InstanceType<typeof ChildExpose>>("exposeChild");

function callExposeReset() {
  exposeRef.value?.reset();
}

function callExposeIncrement() {
  exposeRef.value?.increment(5);
}

const modelText = ref("parent text");
const modelCount = ref(10);

const showAsync = ref(true);
const AsyncChild = defineAsyncComponent(() => import("../components/demo/ChildAsync.vue"));
</script>

<template>
  <div class="view-page">
    <h1>组件 API</h1>
    <p class="view-desc">
      defineProps、defineEmits、defineExpose、defineSlots、defineModel、attrs
      透传、defineAsyncComponent
    </p>

    <DemoCard
      title="defineProps + withDefaults"
      :apis="['defineProps', 'withDefaults']"
      description="子组件声明 props 并设置默认值，父组件传入覆盖。"
    >
      <div class="demo-controls">
        <input v-model="propsLabel" type="text" class="demo-input" placeholder="label" />
        <input v-model.number="propsCount" type="number" class="demo-input" />
        <label class="component-checkbox">
          <input v-model="propsActive" type="checkbox" />
          active
        </label>
      </div>
      <ChildProps :label="propsLabel" :count="propsCount" :active="propsActive" />
      <ChildProps />
    </DemoCard>

    <DemoCard
      title="defineEmits"
      :apis="['defineEmits']"
      description="子组件触发具名事件，父组件监听并记录日志。"
    >
      <ChildEmit @action="onEmitAction" @increment="onEmitIncrement" />
      <template #footer>
        <EventLog :logs="emitLogs" title="emit 日志" @clear="clearEmitLogs" />
      </template>
    </DemoCard>

    <DemoCard
      title="defineExpose"
      :apis="['defineExpose', 'useTemplateRef']"
      description="父组件通过模板 ref 调用子组件暴露的方法。"
      expected="点击「父组件 reset / +5」应操作子组件内部计数，无需通过 props 传递。"
    >
      <ChildExpose ref="exposeChild" />
      <div class="demo-controls">
        <button type="button" class="demo-btn" @click="callExposeReset">父组件 reset</button>
        <button type="button" class="demo-btn" @click="callExposeIncrement">父组件 +5</button>
      </div>
    </DemoCard>

    <DemoCard
      title="defineSlots"
      :apis="['defineSlots', 'slot', 'scoped slot']"
      description="默认插槽、具名插槽与作用域插槽组合渲染。"
    >
      <ChildSlots item="来自 prop 的 item 值">
        <template #header>具名插槽 header 内容</template>
        默认插槽主体内容
        <template #item="{ text }">作用域插槽收到 text = {{ text }}</template>
      </ChildSlots>
    </DemoCard>

    <DemoCard
      title="defineModel"
      :apis="['defineModel', 'v-model', 'v-model:count']"
      description="子组件 defineModel 与父组件 v-model / v-model:count 双向绑定。"
    >
      <ChildModel v-model="modelText" v-model:count="modelCount" />
      <div class="demo-result">父级 text: {{ modelText }}</div>
      <div class="demo-result">父级 count: {{ modelCount }}</div>
    </DemoCard>

    <DemoCard
      title="attrs 透传"
      :apis="['$attrs', 'inheritAttrs']"
      description="子组件 inheritAttrs: false，手动将 attrs 绑定到根元素。"
      expected="data-testid 与 class 应出现在子组件外层 div 上。"
    >
      <ChildAttrs
        title="透传标题"
        data-testid="attrs-demo"
        class="attrs-extra-class"
        aria-label="attrs 示例"
      />
    </DemoCard>

    <DemoCard
      title="defineAsyncComponent"
      :apis="['defineAsyncComponent', ':is']"
      description="动态 import 异步加载 Vapor 子组件。"
      expected="切换显示后重新挂载，加载时间戳会更新。"
    >
      <div class="demo-controls">
        <button type="button" class="demo-btn" @click="showAsync = !showAsync">
          {{ showAsync ? "卸载" : "加载" }}异步组件
        </button>
      </div>
      <component :is="AsyncChild" v-if="showAsync" />
      <div v-else class="demo-result">异步组件已卸载</div>
    </DemoCard>
  </div>
</template>

<style scoped>
.component-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  cursor: pointer;
}
</style>
