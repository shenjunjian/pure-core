<script setup lang="ts" vapor>
import {
  onBeforeMount,
  onBeforeUnmount,
  onBeforeUpdate,
  onErrorCaptured,
  onMounted,
  onUnmounted,
  onUpdated,
  ref,
} from "vue";
import ChildErrorTrigger from "./ChildErrorTrigger.vue";

const props = defineProps<{
  tick: number;
}>();

const emit = defineEmits<{
  log: [message: string];
}>();

const local = ref(0);
const triggerError = ref(false);

function log(message: string) {
  emit("log", message);
}

onBeforeMount(() => log("onBeforeMount"));
onMounted(() => log("onMounted"));
onBeforeUpdate(() => log("onBeforeUpdate"));
onUpdated(() => log("onUpdated"));
onBeforeUnmount(() => log("onBeforeUnmount"));
onUnmounted(() => log("onUnmounted"));

onErrorCaptured((err) => {
  log(`onErrorCaptured: ${(err as Error).message}`);
  triggerError.value = false;
  return false;
});

function onChildFail(message: string) {
  log(`child fail event: ${message}`);
}
</script>

<template>
  <div class="lifecycle-demo">
    <div class="demo-result">props.tick = {{ tick }}，local = {{ local }}</div>
    <div class="demo-controls">
      <button type="button" class="demo-btn demo-btn--sm" @click="local++">
        local++（触发 update）
      </button>
      <button type="button" class="demo-btn demo-btn--sm" @click="triggerError = true">
        触发子组件错误
      </button>
    </div>
    <ChildErrorTrigger v-if="triggerError" should-fail @fail="onChildFail" />
  </div>
</template>

<style scoped>
.lifecycle-demo {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
