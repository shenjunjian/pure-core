<script setup lang="ts" vapor>
import { useAttrs, useId, useSlots } from "vue";

defineOptions({ inheritAttrs: false });

defineProps<{
  title: string;
}>();

const attrs = useAttrs();
const slots = useSlots();
const inputId = useId();
</script>

<template>
  <div class="child-composition-utils" v-bind="attrs">
    <label :for="inputId" class="child-composition-utils__label">{{ title }}</label>
    <input :id="inputId" type="text" class="demo-input" placeholder="useId 生成的 id" />
    <div class="demo-result">useId: {{ inputId }}</div>
    <div class="demo-result">useAttrs keys: {{ Object.keys(attrs).join(", ") || "(none)" }}</div>
    <div class="demo-result">
      useSlots: default={{ !!slots.default }}, header={{ !!slots.header }}
    </div>
    <header v-if="slots.header" class="child-composition-utils__header">
      <slot name="header" />
    </header>
    <slot />
  </div>
</template>

<style scoped>
.child-composition-utils {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 6px;
  border: 1px solid var(--border);
}

.child-composition-utils__label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-h);
}

.child-composition-utils__header {
  padding: 6px 10px;
  border-radius: 4px;
  background: var(--accent-bg);
  font-size: 13px;
}
</style>
