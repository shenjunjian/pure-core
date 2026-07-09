<script setup lang="ts" vapor>
import {
  computed,
  provide,
  reactive,
  readonly,
  ref,
  shallowReactive,
  shallowReadonly,
  shallowRef,
  watch,
  watchEffect,
} from "vue";
import DemoCard from "../components/demo/DemoCard.vue";
import EventLog from "../components/demo/EventLog.vue";
import ChildInject from "../components/demo/ChildInject.vue";
import ChildCompositionUtils from "../components/demo/ChildCompositionUtils.vue";
import ChildEffectScope from "../components/demo/ChildEffectScope.vue";
import ChildModel from "../components/demo/ChildModel.vue";
import { useEventLog } from "../composables/useEventLog";

const count = ref(0);
const name = ref("Vapor");

const state = reactive({ nested: { value: 10 }, tags: ["a", "b"] });
const readonlyState = readonly(state);

const shallowCount = shallowRef({ total: 1 });
const shallowState = shallowReactive({ inner: { x: 1 } });
const shallowReadonlyState = shallowReadonly(shallowState);

const doubled = computed(() => count.value * 2);
const greeting = computed(() => `Hello, ${name.value}!`);

const watchLogs = ref<string[]>([]);
const watchSource = ref(0);

watch(watchSource, (val, oldVal) => {
  watchLogs.value.unshift(`watch: ${oldVal} → ${val}`);
  if (watchLogs.value.length > 8) watchLogs.value.length = 8;
});

const watchEffectLogs = ref<string[]>([]);
watchEffect(() => {
  watchEffectLogs.value.unshift(`watchEffect: count=${count.value}, name=${name.value}`);
  if (watchEffectLogs.value.length > 8) watchEffectLogs.value.length = 8;
});

function clearWatchLogs() {
  watchLogs.value = [];
}

function clearWatchEffectLogs() {
  watchEffectLogs.value = [];
}

const theme = reactive({ color: "#3b82f6", label: "blue" });
const injectedCount = ref(42);
provide("demoTheme", theme);
provide("demoCount", injectedCount);

const modelText = ref("useModel demo");

const utilsTitle = ref("Composition Utils");

const showScopeDemo = ref(true);
const { logs: scopeLogs, log: scopeLog, clear: clearScopeLogs } = useEventLog(30);

function remountScopeDemo() {
  showScopeDemo.value = false;
  scopeLog("--- 卸载 EffectScope 演示组件 ---");
  requestAnimationFrame(() => {
    showScopeDemo.value = true;
    scopeLog("--- 重新挂载 ---");
  });
}

function onScopeDemoLog(message: string) {
  scopeLog(message);
}
</script>

<template>
  <div class="view-page">
    <h1>组合式 API</h1>
    <p class="view-desc">
      ref / reactive / computed / readonly / shallow*、watch / watchEffect、provide /
      inject、useAttrs / useSlots / useId / useModel、effectScope / getCurrentScope / onScopeDispose
    </p>

    <DemoCard
      title="ref 与 reactive"
      :apis="['ref', 'reactive']"
      description="基础响应式状态，ref 用于原始值，reactive 用于对象。"
    >
      <div class="demo-controls">
        <button type="button" class="demo-btn" @click="count++">count++（{{ count }}）</button>
        <input v-model="name" type="text" class="demo-input" placeholder="name" />
        <button type="button" class="demo-btn" @click="state.nested.value++">
          nested.value++（{{ state.nested.value }}）
        </button>
      </div>
      <div class="demo-result">count: {{ count }}</div>
      <div class="demo-result">state.nested: {{ state.nested.value }}</div>
    </DemoCard>

    <DemoCard title="computed" :apis="['computed']" description="派生状态，依赖变化时自动重算。">
      <div class="demo-result">doubled: {{ doubled }}</div>
      <div class="demo-result">greeting: {{ greeting }}</div>
    </DemoCard>

    <DemoCard
      title="readonly 与 shallow*"
      :apis="['readonly', 'shallowRef', 'shallowReactive', 'shallowReadonly']"
      description="只读代理与浅层响应式，深层对象不会触发更新。"
      expected="修改 shallow 内层对象不会更新视图；readonly 阻止写入。"
    >
      <div class="demo-controls">
        <button type="button" class="demo-btn" @click="shallowCount.total++">
          shallowRef.total++（{{ shallowCount.total }}）
        </button>
        <button type="button" class="demo-btn" @click="shallowState.inner.x++">
          shallowReactive.inner.x++（{{ shallowState.inner.x }}）
        </button>
      </div>
      <div class="demo-result">readonlyState.nested: {{ readonlyState.nested.value }}</div>
      <div class="demo-result">shallowReadonly inner.x: {{ shallowReadonlyState.inner.x }}</div>
    </DemoCard>

    <DemoCard
      title="watch 与 watchEffect"
      :apis="['watch', 'watchEffect']"
      description="watch 监听显式源；watchEffect 自动收集依赖。"
    >
      <div class="demo-controls">
        <button type="button" class="demo-btn" @click="watchSource++">
          watchSource++（{{ watchSource }}）
        </button>
        <button type="button" class="demo-btn" @click="count++">count++（影响 watchEffect）</button>
      </div>
      <EventLog :logs="watchLogs" title="watch 日志" @clear="clearWatchLogs" />
      <EventLog :logs="watchEffectLogs" title="watchEffect 日志" @clear="clearWatchEffectLogs" />
    </DemoCard>

    <DemoCard
      title="provide / inject"
      :apis="['provide', 'inject']"
      description="祖先组件 provide，后代组件 inject 读取。"
    >
      <div class="demo-controls">
        <button type="button" class="demo-btn" @click="injectedCount++">
          injectedCount++（{{ injectedCount }}）
        </button>
        <button
          type="button"
          class="demo-btn"
          @click="theme.label = theme.label === 'blue' ? 'green' : 'blue'"
        >
          切换 theme.label（{{ theme.label }}）
        </button>
      </div>
      <ChildInject />
    </DemoCard>

    <DemoCard
      title="useAttrs / useSlots / useId"
      :apis="['useAttrs', 'useSlots', 'useId']"
      description="组合式工具函数：读取 attrs、检测插槽、生成唯一 id。"
    >
      <ChildCompositionUtils
        :title="utilsTitle"
        data-role="composition-demo"
        class="utils-extra-class"
      >
        <template #header>具名插槽 header</template>
        默认插槽内容
      </ChildCompositionUtils>
    </DemoCard>

    <DemoCard
      title="useModel"
      :apis="['useModel', 'defineModel']"
      description="在组合式函数中访问组件 v-model 绑定（此处通过子组件 defineModel 演示双向同步）。"
    >
      <ChildModel v-model="modelText" />
      <div class="demo-result">父级 modelText: {{ modelText }}</div>
    </DemoCard>

    <DemoCard
      title="effectScope / getCurrentScope / onScopeDispose"
      :apis="['effectScope', 'getCurrentScope', 'onScopeDispose']"
      description="在 Vapor 组件 setup 中获取当前作用域、注册作用域销毁回调，以及创建可手动 stop 的 detached effectScope。"
      expected="setup 时 getCurrentScope 返回组件作用域；卸载组件触发 onScopeDispose @组件作用域；stop() detached scope 后 detached watchEffect 不再响应，并触发 onScopeDispose @detached 作用域。"
    >
      <div class="demo-controls">
        <button type="button" class="demo-btn" @click="remountScopeDemo">重新挂载演示组件</button>
      </div>
      <ChildEffectScope v-if="showScopeDemo" @log="onScopeDemoLog" />
      <div v-else class="demo-result">演示组件已卸载</div>
      <template #footer>
        <EventLog :logs="scopeLogs" title="作用域日志" @clear="clearScopeLogs" />
      </template>
    </DemoCard>
  </div>
</template>
