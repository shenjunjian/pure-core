<script setup lang="ts" vapor>
import { computed, ref, useCssModule, useCssVars } from "vue";
import DemoCard from "../components/demo/DemoCard.vue";
import ChildStyleDeep from "../components/demo/ChildStyleDeep.vue";

const isActive = ref(true);
const isDisabled = ref(false);
const themeColor = ref("#3b82f6");
const fontSize = ref(16);
const paddingPx = ref(12);

const classObject = computed(() => ({
  "style-box--active": isActive.value,
  "style-box--disabled": isDisabled.value,
}));

const classArray = computed(() => ["style-box", isActive.value ? "style-box--pulse" : ""]);

const inlineStyle = computed(() => ({
  color: themeColor.value,
  fontSize: `${fontSize.value}px`,
  padding: `${paddingPx.value}px`,
}));

const boxRadius = computed(() => (isActive.value ? "12px" : "4px"));

useCssVars(() => ({
  themeColor: themeColor.value,
  boxRadius: boxRadius.value,
}));

const styles = useCssModule();

console.log("css module style=", styles);
</script>

<template>
  <div class="view-page">
    <h1>样式</h1>
    <p class="view-desc">:class、:style、scoped、:deep()、CSS 变量 v-bind、useCssModule</p>

    <DemoCard
      title="静态 / 对象 / 数组 :class"
      :apis="[':class', 'normalizeClass']"
      description="对象与数组形式动态切换 class。"
    >
      <div class="demo-controls">
        <button type="button" class="demo-btn" @click="isActive = !isActive">toggle active</button>
        <button type="button" class="demo-btn" @click="isDisabled = !isDisabled">
          toggle disabled
        </button>
      </div>
      <div class="style-box style-box--static">静态 class</div>
      <div class="style-box" :class="classObject">对象 :class</div>
      <div :class="classArray">数组 :class</div>
    </DemoCard>

    <DemoCard
      title=":style 绑定"
      :apis="[':style', 'normalizeStyle']"
      description="内联样式对象绑定。"
    >
      <div class="demo-controls">
        <label class="style-control">
          <span>颜色</span>
          <input v-model="themeColor" type="color" />
        </label>
        <label class="style-control">
          <span>字号</span>
          <input v-model.number="fontSize" type="range" min="12" max="24" />
          {{ fontSize }}px
        </label>
        <label class="style-control">
          <span>内边距</span>
          <input v-model.number="paddingPx" type="range" min="4" max="24" />
          {{ paddingPx }}px
        </label>
      </div>
      <div class="style-inline-target" :style="inlineStyle">:style 动态样式文本</div>
    </DemoCard>

    <DemoCard
      title="scoped + :deep()"
      :apis="['scoped', ':deep()']"
      description="父组件 scoped 样式通过 :deep 穿透子组件。"
      expected="子组件 .child-inner 文本应显示为 accent 色并加粗。"
    >
      <ChildStyleDeep />
    </DemoCard>

    <DemoCard
      title="v-bind() CSS 变量"
      :apis="['v-bind()', 'useCssVars']"
      description="在 style 块中使用 v-bind 绑定响应式变量；useCssVars 同步 CSS 变量到根元素。"
      expected="修改主题色与 active 状态后，下方色块颜色与圆角随之变化。"
    >
      <div class="demo-controls">
        <label class="style-control">
          <span>themeColor</span>
          <input v-model="themeColor" type="color" />
        </label>
        <button type="button" class="demo-btn" @click="isActive = !isActive">
          toggle active（圆角）
        </button>
      </div>
      <div class="css-var-box">v-bind 主题色背景块</div>
    </DemoCard>

    <DemoCard
      title="useCssModule"
      :apis="['useCssModule', 'module']"
      description="CSS Modules：通过 $style 或 useCssModule() 获取局部类名。"
    >
      <div :class="styles.moduleBox">
        <p :class="styles.moduleTitle">Module 标题</p>
        <p :class="styles.moduleDesc">类名经 hash 处理，避免全局污染。</p>
      </div>
    </DemoCard>
  </div>
</template>

<style scoped>
.style-box {
  padding: 10px 14px;
  border-radius: 6px;
  border: 1px solid var(--border);
  margin-bottom: 8px;
  font-size: 14px;
  transition: all 0.2s;
}

.style-box--static {
  background: var(--code-bg);
}

.style-box--active {
  border-color: var(--accent-border);
  background: var(--accent-bg);
  color: var(--accent);
}

.style-box--disabled {
  opacity: 0.5;
}

.style-box--pulse {
  border-color: #8b5cf6;
  background: #f5f3ff;
  color: #5b21b6;
}

.style-inline-target {
  border-radius: 6px;
  border: 1px solid var(--border);
  font-weight: 500;
}

.style-control {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.style-control > span {
  min-width: 80px;
  color: var(--text);
}

.css-var-box {
  padding: 16px 20px;
  border-radius: v-bind(boxRadius);
  background: v-bind(themeColor);
  color: #fff;
  font-weight: 500;
  transition:
    background 0.2s,
    border-radius 0.2s;
}

:deep(.child-inner) {
  color: var(--accent);
  font-weight: 600;
  margin: 0;
}
</style>

<style module>
.moduleBox {
  padding: 14px 18px;
  border-radius: 8px;
  border: 2px solid #10b981;
  background: #ecfdf5;
}

.moduleTitle {
  margin: 0 0 6px;
  font-weight: 600;
  color: #065f46;
}

.moduleDesc {
  margin: 0;
  font-size: 14px;
  color: #047857;
}
</style>
