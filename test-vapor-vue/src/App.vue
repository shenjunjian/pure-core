<script setup lang="ts" vapor>
import { computed, ref } from "vue";
import OverviewView from "./views/OverviewView.vue";
import RenderingView from "./views/RenderingView.vue";
import DirectivesView from "./views/DirectivesView.vue";
import StyleView from "./views/StyleView.vue";
import ComponentView from "./views/ComponentView.vue";
import BuiltinView from "./views/BuiltinView.vue";
import CompositionView from "./views/CompositionView.vue";
import LifecycleView from "./views/LifecycleView.vue";
import LimitationsView from "./views/LimitationsView.vue";

type SectionId =
  | "overview"
  | "rendering"
  | "directives"
  | "style"
  | "component"
  | "builtin"
  | "composition"
  | "lifecycle"
  | "limitations";

const sections: { id: SectionId; label: string; component: object }[] = [
  { id: "overview", label: "总览", component: OverviewView },
  { id: "rendering", label: "渲染", component: RenderingView },
  { id: "directives", label: "指令", component: DirectivesView },
  { id: "style", label: "样式", component: StyleView },
  { id: "component", label: "组件 API", component: ComponentView },
  { id: "builtin", label: "内置组件", component: BuiltinView },
  { id: "composition", label: "组合式 API", component: CompositionView },
  { id: "lifecycle", label: "生命周期", component: LifecycleView },
  { id: "limitations", label: "限制说明", component: LimitationsView },
];

const activeId = ref<SectionId>("overview");

const activeComponent = computed(() => sections.find((s) => s.id === activeId.value)!.component);
</script>

<template>
  <div class="app-layout">
    <aside class="sidebar">
      <h1 class="sidebar-title">Vapor API</h1>
      <nav class="sidebar-nav">
        <button
          v-for="item in sections"
          :key="item.id"
          type="button"
          class="nav-link"
          :class="{ active: activeId === item.id }"
          @click="activeId = item.id"
        >
          {{ item.label }}
        </button>
      </nav>
    </aside>
    <main class="main-content">
      <component :is="activeComponent" />
    </main>
  </div>
</template>
