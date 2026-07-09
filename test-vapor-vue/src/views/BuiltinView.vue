<script setup lang="ts" vapor>
import { ref } from "vue";
import DemoCard from "../components/demo/DemoCard.vue";
import EventLog from "../components/demo/EventLog.vue";
import ChildKeepAliveA from "../components/demo/ChildKeepAliveA.vue";
import ChildKeepAliveB from "../components/demo/ChildKeepAliveB.vue";
import { useEventLog } from "../composables/useEventLog";

const showTransition = ref(true);

const listItems = ref([
  { id: 1, label: "Vue" },
  { id: 2, label: "Vapor" },
  { id: 3, label: "Compiler" },
]);
let nextId = 4;

function addItem() {
  listItems.value.push({ id: nextId++, label: `Item ${nextId - 1}` });
}

function removeItem() {
  if (listItems.value.length) {
    listItems.value.pop();
  }
}

const keepAliveTab = ref<"a" | "b">("a");
const keepAliveComponents = { a: ChildKeepAliveA, b: ChildKeepAliveB };
const { logs: keepAliveLogs, log: logKeepAlive, clear: clearKeepAliveLogs } = useEventLog(16);

function onKeepAliveLifecycle(event: "activated" | "deactivated", tab: string) {
  logKeepAlive(`${tab} ${event}`);
}

const showModal = ref(false);
</script>

<template>
  <div class="view-page">
    <h1>内置组件</h1>
    <p class="view-desc">Transition、TransitionGroup、KeepAlive、Teleport（Vapor 版内置组件）</p>

    <DemoCard
      title="Transition"
      :apis="['<Transition>', 'enter/leave 类名']"
      description="单元素进出场过渡动画。"
      expected="切换显示时，方块应淡入淡出并伴随位移。"
    >
      <div class="demo-controls">
        <button type="button" class="demo-btn" @click="showTransition = !showTransition">
          {{ showTransition ? "隐藏" : "显示" }}
        </button>
      </div>
      <Transition name="fade-slide">
        <div v-if="showTransition" class="transition-box">Transition 内容块</div>
      </Transition>
    </DemoCard>

    <DemoCard
      title="TransitionGroup"
      :apis="['<TransitionGroup>', 'list 过渡']"
      description="列表增删时带动画的 TransitionGroup。"
      expected="添加 / 移除列表项时，其余项平滑移动，进出场有过渡。"
    >
      <div class="demo-controls">
        <button type="button" class="demo-btn" @click="addItem">添加项</button>
        <button type="button" class="demo-btn" @click="removeItem">移除末项</button>
      </div>
      <TransitionGroup name="list" tag="ul" class="transition-list">
        <li v-for="item in listItems" :key="item.id" class="transition-list__item">
          {{ item.label }}
        </li>
      </TransitionGroup>
    </DemoCard>

    <DemoCard
      title="KeepAlive"
      :apis="['<KeepAlive>', 'onActivated', 'onDeactivated']"
      description="缓存 Tab 子组件，切换时触发 activated / deactivated。"
      expected="切换 Tab 后输入框与计数状态保留；EventLog 记录生命周期。"
    >
      <div class="demo-controls">
        <button
          type="button"
          class="demo-btn"
          :class="{ 'demo-btn--active': keepAliveTab === 'a' }"
          @click="keepAliveTab = 'a'"
        >
          Tab A
        </button>
        <button
          type="button"
          class="demo-btn"
          :class="{ 'demo-btn--active': keepAliveTab === 'b' }"
          @click="keepAliveTab = 'b'"
        >
          Tab B
        </button>
      </div>
      <KeepAlive>
        <component :is="keepAliveComponents[keepAliveTab]" @lifecycle="onKeepAliveLifecycle" />
      </KeepAlive>
      <template #footer>
        <EventLog
          :logs="keepAliveLogs"
          title="KeepAlive 生命周期"
          empty-text="切换 Tab 后此处显示 activated / deactivated"
          @clear="clearKeepAliveLogs"
        />
      </template>
    </DemoCard>

    <DemoCard
      title="Teleport"
      :apis="['<Teleport>', 'to=body']"
      description="将模态框渲染到 document.body，脱离当前 DOM 层级。"
      expected="打开模态后，遮罩与对话框出现在 body 末尾，而非侧边栏内。"
    >
      <div class="demo-controls">
        <button type="button" class="demo-btn" @click="showModal = true">打开 Teleport 模态</button>
      </div>
      <Teleport to="body">
        <div v-if="showModal" class="teleport-overlay" @click.self="showModal = false">
          <div class="teleport-modal" role="dialog" aria-modal="true">
            <h4 class="teleport-modal__title">Teleport 模态框</h4>
            <p class="teleport-modal__body">此内容通过 Teleport 渲染到 body。</p>
            <button type="button" class="demo-btn" @click="showModal = false">关闭</button>
          </div>
        </div>
      </Teleport>
    </DemoCard>
  </div>
</template>

<style scoped>
.transition-box {
  padding: 16px 20px;
  border-radius: 8px;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  color: var(--text-h);
  font-weight: 500;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.transition-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
}

.transition-list__item {
  padding: 10px 14px;
  border-radius: 6px;
  background: var(--code-bg);
  font-family: var(--mono);
  font-size: 14px;
}

.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.list-move {
  transition: transform 0.3s ease;
}

.list-leave-active {
  position: absolute;
  width: 100%;
}

.demo-btn--active {
  background: var(--accent-bg);
  border-color: var(--accent-border);
  color: var(--accent);
  font-weight: 500;
}
</style>

<style>
.teleport-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
}

.teleport-modal {
  min-width: 280px;
  max-width: 90vw;
  padding: 24px;
  border-radius: 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
}

.teleport-modal__title {
  margin: 0 0 8px;
  font-size: 18px;
  color: var(--text-h);
}

.teleport-modal__body {
  margin: 0 0 16px;
  font-size: 15px;
  color: var(--text);
  line-height: 1.5;
}
</style>
