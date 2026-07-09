<script setup lang="ts" vapor>
const text = defineModel<string>({ default: "" });
const count = defineModel<number>("count", { default: 0 });
</script>

<template>
  <div class="child-model">
    <label class="child-model__field">
      <span>text model</span>
      <input v-model="text" type="text" class="demo-input" placeholder="子组件内编辑" />
    </label>
    <label class="child-model__field">
      <span>count model</span>
      <input v-model.number="count" type="number" class="demo-input" />
    </label>
  </div>
</template>
