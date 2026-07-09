<script setup lang="ts" vapor>
import {
  effectScope,
  getCurrentScope,
  onScopeDispose,
  ref,
  watchEffect,
  type EffectScope,
} from "vue";

const emit = defineEmits<{
  log: [message: string];
}>();

function log(message: string) {
  emit("log", message);
}

function describeScope(scope: EffectScope | undefined) {
  if (!scope) return "null（无活动作用域）";
  return `EffectScope(active=${scope.active})`;
}

const counter = ref(0);

const setupScope = getCurrentScope();
log(`getCurrentScope() @setup: ${describeScope(setupScope ?? undefined)}`);

onScopeDispose(() => {
  log("onScopeDispose @组件作用域");
});

watchEffect(() => {
  log(`组件 scope watchEffect: counter=${counter.value}`);
});

let detachedScope = effectScope(true);
const detachedCounter = ref(0);
const detachedActive = ref(false);

function runDetachedScope() {
  detachedScope.run(() => {
    log(`getCurrentScope() @detached.run: ${describeScope(getCurrentScope() ?? undefined)}`);

    watchEffect(() => {
      log(`detached watchEffect: detachedCounter=${detachedCounter.value}`);
    });

    onScopeDispose(() => {
      log("onScopeDispose @detached 作用域");
      detachedActive.value = false;
    });
  });
  detachedActive.value = detachedScope.active;
  log("effectScope(true).run() 已启动");
}

function stopDetachedScope() {
  if (detachedScope.active) {
    detachedScope.stop();
    log("effectScope.stop() 手动停止");
  }
}

function recreateDetachedScope() {
  if (detachedScope.active) {
    detachedScope.stop();
  }
  detachedScope = effectScope(true);
  detachedCounter.value = 0;
  runDetachedScope();
  log("重新创建 detached effectScope");
}

runDetachedScope();
</script>

<template>
  <div class="child-effect-scope">
    <div class="demo-result">
      组件作用域 active: {{ setupScope?.active ?? false }}，detached active:
      {{ detachedActive }}
    </div>
    <div class="demo-controls">
      <button type="button" class="demo-btn demo-btn--sm" @click="counter++">
        counter++（{{ counter }}，触发组件 watchEffect）
      </button>
      <button type="button" class="demo-btn demo-btn--sm" @click="detachedCounter++">
        detachedCounter++（{{ detachedCounter }}）
      </button>
      <button
        type="button"
        class="demo-btn demo-btn--sm"
        :disabled="!detachedActive"
        @click="stopDetachedScope"
      >
        stop() detached scope
      </button>
      <button type="button" class="demo-btn demo-btn--sm" @click="recreateDetachedScope">
        重建 detached scope
      </button>
    </div>
  </div>
</template>

<style scoped>
.child-effect-scope {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
