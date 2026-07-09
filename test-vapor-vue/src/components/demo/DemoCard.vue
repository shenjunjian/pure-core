<script setup lang="ts" vapor>
defineProps<{
  title: string;
  apis?: string[];
  description?: string;
  expected?: string;
}>();
</script>

<template>
  <section class="demo-card">
    <header class="demo-card__header">
      <h3 class="demo-card__title">{{ title }}</h3>
      <div v-if="apis?.length" class="demo-card__tags">
        <code v-for="api in apis" :key="api" class="demo-card__tag">{{ api }}</code>
      </div>
    </header>
    <p v-if="description" class="demo-card__desc">{{ description }}</p>
    <p v-if="expected" class="demo-card__expected">
      <span class="demo-card__expected-label">预期行为</span>
      {{ expected }}
    </p>
    <div class="demo-card__body">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="demo-card__footer">
      <slot name="footer" />
    </footer>
  </section>
</template>
