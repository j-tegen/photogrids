<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGridStore } from '@/stores/gridStore'
import GridCell from './GridCell.vue'
import ResizeHandle from './ResizeHandle.vue'

const gridStore = useGridStore()
const gridRef = ref<HTMLElement | null>(null)

const gridStyle = computed(() => ({
  gridTemplateRows: gridStore.gridTemplateRows,
  gridTemplateColumns: gridStore.gridTemplateColumns,
  aspectRatio: gridStore.aspectRatioValue,
}))

// Calculate positions for resize handles
const rowHandlePositions = computed(() => {
  const positions: number[] = []
  let cumulative = 0
  for (let i = 0; i < gridStore.rowHeights.length - 1; i++) {
    cumulative += gridStore.rowHeights[i] ?? 0
    positions.push(cumulative)
  }
  return positions
})

const columnHandlePositions = computed(() => {
  const positions: number[] = []
  let cumulative = 0
  for (let i = 0; i < gridStore.columnWidths.length - 1; i++) {
    cumulative += gridStore.columnWidths[i] ?? 0
    positions.push(cumulative)
  }
  return positions
})

function isLastInColumn(cell: (typeof gridStore.cells)[number]) {
  const endRow = cell.row + cell.rowSpan - 1
  return endRow >= gridStore.rows
}

function isLastInRow(cell: (typeof gridStore.cells)[number]) {
  const endCol = cell.col + cell.colSpan - 1
  return endCol >= gridStore.columns
}

defineExpose({
  gridRef,
})
</script>

<template>
  <div class="photo-grid-wrapper" ref="gridRef">
    <div class="photo-grid" :style="gridStyle">
      <GridCell
        v-for="cell in gridStore.cells"
        :key="cell.id"
        :cell="cell"
        :is-last-in-column="isLastInColumn(cell)"
        :is-last-in-row="isLastInRow(cell)"
      />
    </div>

    <!-- Row resize handles -->
    <ResizeHandle
      v-for="(pos, index) in rowHandlePositions"
      :key="`row-${index}`"
      type="row"
      :index="index"
      :style="{ top: `${pos}%` }"
    />

    <!-- Column resize handles -->
    <ResizeHandle
      v-for="(pos, index) in columnHandlePositions"
      :key="`col-${index}`"
      type="column"
      :index="index"
      :style="{ left: `${pos}%` }"
    />
  </div>
</template>

<style scoped>
.photo-grid-wrapper {
  position: relative;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}

.photo-grid {
  display: grid;
  width: 100%;
  background-color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>
