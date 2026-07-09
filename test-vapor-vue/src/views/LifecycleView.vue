<script setup lang="ts" vapor>
import { ref } from "vue";
import DemoCard from "../components/demo/DemoCard.vue";
import EventLog from "../components/demo/EventLog.vue";
import LifecycleDemo from "../components/demo/LifecycleDemo.vue";
import { useEventLog } from "../composables/useEventLog";

const showDemo = ref(true);
const tick = ref(0);
const { logs, log, clear } = useEventLog(30);

function remount() {
  showDemo.value = false;
  log("--- 卸载组件 ---");
  requestAnimationFrame(() => {
    showDemo.value = true;
    log("--- 重新挂载 ---");
  });
}

function bumpTick() {
  tick.value += 1;
  log(`父级 tick → ${tick.value}`);
}

function onLifecycleLog(message: string) {
  log(message);
}
</script>

<template>
  <div class="view-page">
    <h1>生命周期</h1>
    <p class="view-desc">
      onBeforeMount / onMounted / onBeforeUpdate / onUpdated / onBeforeUnmount / onUnmounted /
      onErrorCaptured
    </p>

    <DemoCard
      title="组合式生命周期钩子"
      :apis="[
        'onBeforeMount',
        'onMounted',
        'onBeforeUpdate',
        'onUpdated',
        'onBeforeUnmount',
        'onUnmounted',
        'onErrorCaptured',
      ]"
      description="单一演示组件挂载全部钩子，配合 EventLog 实时输出。"
      expected="重新挂载触发 mount/unmount；local++ 触发 update；错误按钮触发 onErrorCaptured。"
    >
      <div class="demo-controls">
        <button type="button" class="demo-btn" @click="remount">重新挂载组件</button>
        <button type="button" class="demo-btn" @click="bumpTick">父级 tick++（{{ tick }}）</button>
      </div>
      <LifecycleDemo v-if="showDemo" :tick="tick" @log="onLifecycleLog" />
      <div v-else class="demo-result">组件已卸载，点击「重新挂载组件」恢复</div>
      <template #footer>
        <EventLog :logs="logs" title="生命周期日志" @clear="clear" />
      </template>
    </DemoCard>

    <DemoCard
      title="onActivated / onDeactivated"
      :apis="['onActivated', 'onDeactivated']"
      description="KeepAlive 缓存组件的激活/停用钩子，详见「内置组件」页的 KeepAlive 示例。"
    >
      <p class="lifecycle-hint">
        请切换到侧边栏「内置组件」→ KeepAlive 卡片，切换 Tab A/B 观察 activated / deactivated 日志。
      </p>
    </DemoCard>
  </div>
</template>

<style scoped>
.lifecycle-hint {
  margin: 0;
  padding: 12px 14px;
  border-radius: 6px;
  background: var(--accent-bg);
  border-left: 3px solid var(--accent);
  font-size: 14px;
  line-height: 1.5;
  color: var(--text);
}
</style>
