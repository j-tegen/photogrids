<script setup lang="ts">
import { computed, ref } from 'vue'
import { InputNumber, Select, Switch, Slider, Divider, Typography } from 'ant-design-vue'
import type { SelectValue } from 'ant-design-vue/es/select'
import { useGridStore } from '@/stores/gridStore'
import { ASPECT_RATIO_PRESETS } from '@/types/grid'

const gridStore = useGridStore()

const aspectRatioOptions = computed(() => [
  ...ASPECT_RATIO_PRESETS.map((ratio) => ({
    value: ratio.label,
    label: ratio.label,
  })),
  { value: 'custom', label: 'Custom' },
])

const selectedAspectRatio = ref(gridStore.aspectRatio.label)
const customWidth = ref(gridStore.aspectRatio.width)
const customHeight = ref(gridStore.aspectRatio.height)

const isCustomAspectRatio = computed(() => selectedAspectRatio.value === 'custom')

function handleRowsChange(val: number | string | null) {
  if (typeof val === 'number') {
    gridStore.setRows(val)
  }
}

function handleColumnsChange(val: number | string | null) {
  if (typeof val === 'number') {
    gridStore.setColumns(val)
  }
}

function handleAspectRatioChange(value: SelectValue) {
  if (typeof value !== 'string') return
  selectedAspectRatio.value = value

  if (value === 'custom') {
    gridStore.setAspectRatio({
      width: customWidth.value,
      height: customHeight.value,
      label: 'custom',
    })
  } else {
    const preset = ASPECT_RATIO_PRESETS.find((r) => r.label === value)
    if (preset) {
      gridStore.setAspectRatio(preset)
    }
  }
}

function handleCustomAspectRatioChange() {
  if (isCustomAspectRatio.value) {
    gridStore.setAspectRatio({
      width: customWidth.value,
      height: customHeight.value,
      label: 'custom',
    })
  }
}

function handleInnerLinesChange(checked: boolean | string | number) {
  gridStore.updateGridLines({ showInnerLines: Boolean(checked) })
}

function handleEdgesChange(checked: boolean | string | number) {
  gridStore.updateGridLines({ showEdges: Boolean(checked) })
}

function handleThicknessChange(val: number | [number, number]) {
  if (typeof val === 'number') {
    gridStore.updateGridLines({ thickness: val })
  }
}
</script>

<template>
  <div class="grid-controls">
    <Typography.Title :level="5">Grid Size</Typography.Title>

    <div class="control-row">
      <label>Rows</label>
      <InputNumber :value="gridStore.rows" :min="2" :max="4" @change="handleRowsChange" />
      <label>Columns</label>
      <InputNumber :value="gridStore.columns" :min="2" :max="4" @change="handleColumnsChange" />
    </div>

    <Divider />

    <Typography.Title :level="5">Aspect Ratio</Typography.Title>

    <div class="control-row">
      <label>Preset</label>
      <Select
        :value="selectedAspectRatio"
        :options="aspectRatioOptions"
        style="width: 120px"
        @change="handleAspectRatioChange"
      />
    </div>

    <template v-if="isCustomAspectRatio">
      <div class="control-row">
        <label>Width</label>
        <InputNumber
          v-model:value="customWidth"
          :min="1"
          :max="100"
          @change="handleCustomAspectRatioChange"
        />
        <label>Height</label>
        <InputNumber
          v-model:value="customHeight"
          :min="1"
          :max="100"
          @change="handleCustomAspectRatioChange"
        />
      </div>
    </template>

    <Divider />

    <Typography.Title :level="5">Grid Lines</Typography.Title>

    <div class="control-row">
      <label>Inner Lines</label>
      <Switch :checked="gridStore.gridLines.showInnerLines" @change="handleInnerLinesChange" />
      <label>Edges</label>
      <Switch :checked="gridStore.gridLines.showEdges" @change="handleEdgesChange" />
    </div>

    <div class="control-row">
      <label>Thickness</label>
      <Slider
        :value="gridStore.gridLines.thickness"
        :min="1"
        :max="10"
        style="width: 100px"
        @change="handleThicknessChange"
      />
      <span class="value-label">{{ gridStore.gridLines.thickness }}px</span>
      <label>Color</label>
      <input
        type="color"
        :value="gridStore.gridLines.color"
        class="color-input"
        @input="(e) => gridStore.updateGridLines({ color: (e.target as HTMLInputElement).value })"
      />
    </div>

    <div class="control-row">
      <label>Background</label>
      <input
        type="color"
        :value="gridStore.backgroundColor"
        class="color-input"
        @input="(e) => gridStore.setBackgroundColor((e.target as HTMLInputElement).value)"
      />
    </div>
  </div>
</template>

<style scoped>
.grid-controls {
  padding: 16px;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.control-row label {
  min-width: 80px;
  color: rgba(0, 0, 0, 0.65);
}

.value-label {
  min-width: 40px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}

.color-input {
  width: 40px;
  height: 32px;
  padding: 2px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  cursor: pointer;
}

.color-input:hover {
  border-color: #40a9ff;
}
</style>
