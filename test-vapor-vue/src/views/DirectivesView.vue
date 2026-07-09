<script setup lang="ts" vapor>
import { ref, unref, watchEffect } from "vue";
import DemoCard from "../components/demo/DemoCard.vue";
import ChildModel from "../components/demo/ChildModel.vue";

const condition = ref<"a" | "b" | "c">("a");
const showPanel = ref(true);

const listItems = ref([
  { id: 1, label: "Alpha", visible: true },
  { id: 2, label: "Beta", visible: false },
  { id: 3, label: "Gamma", visible: true },
]);

const objectMap = ref({ name: "Vapor", version: "3.6.0-beta.17", mode: "vapor" });
const templateTags = ref(["vue", "vapor", "compiler"]);

const textModel = ref("hello");
const numberModel = ref(42);
const checked = ref(true);
const radioVal = ref("a");
const selectVal = ref("vue");
const multiSelect = ref(["a", "c"]);
const modelText = ref("");
const modelCount = ref(0);

const eventLog = ref<string[]>([]);

const highlightOn = ref(false);

const vHighlight = (el: HTMLElement, source?: () => unknown) => {
  return watchEffect(() => {
    console.log(source?.());
    const on = unref(source?.());
    el.style.background = on ? "#fef08a" : "";
  });
};

function logEvent(name: string) {
  eventLog.value.unshift(name);
  if (eventLog.value.length > 12) eventLog.value.length = 12;
}

function onParentClick() {
  logEvent("parent click");
}

function onChildClick() {
  logEvent("child click (should not bubble if stopped)");
}

function onSelfClick() {
  logEvent("self target click");
}

function onKeydown(e: KeyboardEvent) {
  logEvent(`keydown: ${e.key}`);
}
</script>

<template>
  <div class="view-page">
    <h1>指令</h1>
    <p class="view-desc">v-if / v-show / v-for、v-model、v-on 修饰符、自定义 Vapor 指令</p>

    <DemoCard
      title="v-if / v-else-if / v-else"
      :apis="['v-if', 'v-else-if', 'v-else']"
      description="条件分支渲染。"
    >
      <div class="demo-controls">
        <button
          type="button"
          class="demo-btn"
          :class="{ 'demo-btn--active': condition === 'a' }"
          @click="condition = 'a'"
        >
          A
        </button>
        <button
          type="button"
          class="demo-btn"
          :class="{ 'demo-btn--active': condition === 'b' }"
          @click="condition = 'b'"
        >
          B
        </button>
        <button
          type="button"
          class="demo-btn"
          :class="{ 'demo-btn--active': condition === 'c' }"
          @click="condition = 'c'"
        >
          C
        </button>
      </div>
      <p v-if="condition === 'a'" class="demo-result">分支 A 可见</p>
      <p v-else-if="condition === 'b'" class="demo-result">分支 B 可见</p>
      <p v-else class="demo-result">分支 C（else）可见</p>
    </DemoCard>

    <DemoCard title="v-show" :apis="['v-show']" description="切换 display，元素保留在 DOM 中。">
      <div class="demo-controls">
        <button type="button" class="demo-btn" @click="showPanel = !showPanel">
          toggle v-show
        </button>
      </div>
      <p v-show="showPanel" class="demo-result">v-show 面板（show={{ showPanel }}）</p>
    </DemoCard>

    <DemoCard
      title="v-for 数组"
      :apis="['v-for']"
      description="遍历数组；<template> 上双指令的编译结构 v-for + v-if是支持的，但同一dom元素是不支持的 。"
      expected="仅 visible=true 的项显示。"
    >
      <ul class="directive-list">
        <template v-for="item in listItems" :key="item.id">
          <li v-if="item.visible" class="directive-list__item">
            #{{ item.id }} — {{ item.label }}
          </li>
        </template>
      </ul>
      <div class="demo-controls">
        <button
          type="button"
          class="demo-btn demo-btn--sm"
          @click="listItems[1].visible = !listItems[1].visible"
        >
          切换 Beta visible
        </button>
      </div>
    </DemoCard>

    <DemoCard title="v-for 对象" :apis="['v-for']" description="遍历对象的键值对。">
      <ul class="directive-list">
        <li v-for="(val, key) in objectMap" :key="key" class="directive-list__item">
          {{ key }}: {{ val }}
        </li>
      </ul>
    </DemoCard>

    <DemoCard
      title="template v-for"
      :apis="['v-for', 'template']"
      description="在 template 上使用 v-for 渲染多个节点。"
    >
      <template v-for="tag in templateTags" :key="tag">
        <span class="tag-chip">{{ tag }}</span>
      </template>
    </DemoCard>

    <DemoCard
      title="v-model 原生控件"
      :apis="['v-model', 'v-model.number']"
      description="text / number / checkbox / radio / select / multiple select。"
    >
      <div class="model-grid">
        <label class="model-field">
          <span>text</span>
          <input v-model="textModel" type="text" class="demo-input" />
        </label>
        <label class="model-field">
          <span>number</span>
          <input v-model.number="numberModel" type="number" class="demo-input" />
        </label>
        <label class="model-field">
          <span>checkbox</span>
          <input v-model="checked" type="checkbox" />
          {{ checked }}
        </label>
        <fieldset class="model-field model-field--row">
          <span>radio</span>
          <label><input v-model="radioVal" type="radio" value="a" /> A</label>
          <label><input v-model="radioVal" type="radio" value="b" /> B</label>
        </fieldset>
        <label class="model-field">
          <span>select</span>
          <select v-model="selectVal" class="demo-input">
            <option value="vue">Vue</option>
            <option value="vapor">Vapor</option>
            <option value="pure">Pure</option>
          </select>
        </label>
        <label class="model-field">
          <span>multiple</span>
          <select v-model="multiSelect" multiple class="demo-input demo-input--multi">
            <option value="a">A</option>
            <option value="b">B</option>
            <option value="c">C</option>
          </select>
        </label>
      </div>
      <div class="demo-result">
        text={{ textModel }} | number={{ numberModel }} | checked={{ checked }} | radio={{
          radioVal
        }}
        | select={{ selectVal }} | multi={{ multiSelect.join(",") }}
      </div>
    </DemoCard>

    <DemoCard
      title="v-model 组件"
      :apis="['v-model', 'defineModel']"
      description="父组件 v-model / v-model:count 与子组件 defineModel 双向绑定。"
    >
      <ChildModel v-model="modelText" v-model:count="modelCount" />
      <div class="demo-result">父级 text={{ modelText }} | count={{ modelCount }}</div>
    </DemoCard>

    <DemoCard
      title="v-on 修饰符"
      :apis="['v-on', '.prevent', '.stop', '.once', '.self', '.capture']"
      description="事件修饰符与按键修饰符。"
    >
      <div class="event-demo" @click="onParentClick">
        <p class="event-demo__hint">父容器（点击测试 .self / .stop / .capture）</p>
        <button type="button" class="demo-btn" @click.stop="onChildClick">.stop 子按钮</button>
        <button type="button" class="demo-btn" @click.self="onSelfClick">
          .self 按钮 -- <span>inner span</span>
        </button>
        <button type="button" class="demo-btn" @click.once="logEvent('once fired')">.once</button>
        <a href="#" class="demo-btn demo-btn--link" @click.prevent="logEvent('prevented link')"
          >.prevent 链接</a
        >
        <input
          type="text"
          class="demo-input"
          placeholder="按 Enter 测试 .enter"
          @keydown.enter="onKeydown"
        />
      </div>
      <ul v-if="eventLog.length" class="event-log-inline">
        <li v-for="(entry, i) in eventLog" :key="i">{{ entry }}</li>
      </ul>
      <p v-else class="demo-result">尚无事件记录</p>
    </DemoCard>

    <DemoCard
      title="自定义 Vapor 指令"
      :apis="['withVaporDirectives', 'watchEffect']"
      description="指令 handler 接收 (el, value) 并通过 watchEffect 响应式更新 DOM。"
      expected="开启高亮后，目标元素背景变为黄色。"
    >
      <div class="demo-controls">
        <button type="button" class="demo-btn" @click="highlightOn = !highlightOn">
          {{ highlightOn ? "关闭" : "开启" }}高亮
        </button>
      </div>
      <p v-highlight="highlightOn" class="demo-result">v-highlight 目标元素</p>
    </DemoCard>
  </div>
</template>

<style scoped>
.directive-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.directive-list__item {
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--code-bg);
  font-family: var(--mono);
  font-size: 13px;
}

.tag-chip {
  display: inline-block;
  margin-right: 8px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--accent-bg);
  color: var(--accent);
  font-size: 13px;
  font-weight: 500;
}

.model-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.model-field {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}

.model-field > span {
  min-width: 72px;
  color: var(--text);
}

.model-field--row {
  border: none;
  padding: 0;
  margin: 0;
  gap: 12px;
}

.demo-input--multi {
  min-height: 72px;
}

.event-demo {
  padding: 12px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.event-demo__hint {
  margin: 0;
  font-size: 13px;
  color: var(--text);
}

.demo-btn--active {
  background: var(--accent-bg);
  border-color: var(--accent-border);
  color: var(--accent);
}

.demo-btn--link {
  display: inline-block;
  text-decoration: none;
  text-align: center;
}

.event-log-inline {
  list-style: none;
  margin: 0;
  padding: 0;
  font-family: var(--mono);
  font-size: 13px;
}

.event-log-inline li {
  padding: 4px 0;
  border-bottom: 1px solid var(--border);
}

.event-log-inline li:last-child {
  border-bottom: none;
}
</style>
