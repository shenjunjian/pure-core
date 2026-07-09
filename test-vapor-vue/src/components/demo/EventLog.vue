<script setup lang="ts" vapor>
withDefaults(
  defineProps<{
    logs: string[];
    title?: string;
    emptyText?: string;
  }>(),
  {
    title: "事件日志",
    emptyText: "暂无记录，触发交互后此处会显示输出",
  },
);

const emit = defineEmits<{
  clear: [];
}>();
</script>

<template>
  <div class="event-log">
    <div class="event-log__header">
      <span class="event-log__title">{{ title }}</span>
      <button v-if="logs.length" type="button" class="event-log__clear" @click="emit('clear')">
        清空
      </button>
    </div>
    <ul class="event-log__list">
      <li v-if="!logs.length" class="event-log__empty">{{ emptyText }}</li>
      <li v-for="(entry, index) in logs" :key="index" class="event-log__entry">
        {{ entry }}
      </li>
    </ul>
  </div>
</template>
