<script setup lang="ts" vapor>
import { onMounted, ref } from "vue";

const props = defineProps<{
  shouldFail?: boolean;
}>();

const emit = defineEmits<{
  fail: [message: string];
}>();

const mounted = ref(false);

onMounted(() => {
  mounted.value = true;
  if (props.shouldFail) {
    emit("fail", "子组件渲染时触发错误");
    throw new Error("LifecycleDemo 故意抛出的错误");
  }
});
</script>

<template>
  <div v-if="!shouldFail" class="error-child">正常子组件</div>
  <div v-else class="error-child error-child--fail">即将抛出错误…</div>
</template>

<style scoped>
.error-child {
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--code-bg);
  font-size: 13px;
}

.error-child--fail {
  background: #fef2f2;
  color: #991b1b;
}
</style>
