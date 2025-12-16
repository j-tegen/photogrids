import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { GridCell, GridLineSettings, AspectRatio } from '@/types/grid'
import { ASPECT_RATIO_PRESETS } from '@/types/grid'

function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}

function createInitialCells(rows: number, cols: number): GridCell[] {
  const cells: GridCell[] = []
  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= cols; col++) {
      cells.push({
        id: generateId(),
        row,
        col,
        rowSpan: 1,
        colSpan: 1,
        imageUrl: null,
        imageFile: null,
        imagePosition: { x: 50, y: 50 },
      })
    }
  }
  return cells
}

function createEqualSizes(count: number): number[] {
  return Array(count).fill(100 / count)
}

const DEFAULT_ASPECT_RATIO: AspectRatio = { width: 1, height: 1, label: '1:1' }

export const useGridStore = defineStore('grid', () => {
  // State
  const rows = ref(3)
  const columns = ref(3)
  const cells = ref<GridCell[]>(createInitialCells(3, 3))
  const rowHeights = ref<number[]>(createEqualSizes(3))
  const columnWidths = ref<number[]>(createEqualSizes(3))
  const aspectRatio = ref<AspectRatio>(ASPECT_RATIO_PRESETS[0] ?? DEFAULT_ASPECT_RATIO)
  const gridLines = ref<GridLineSettings>({
    showInnerLines: true,
    showEdges: true,
    thickness: 2,
    color: '#000000',
  })

  // Computed
  const gridTemplateRows = computed(() => {
    return rowHeights.value.map((h) => `${h}%`).join(' ')
  })

  const gridTemplateColumns = computed(() => {
    return columnWidths.value.map((w) => `${w}%`).join(' ')
  })

  const aspectRatioValue = computed(() => {
    return `${aspectRatio.value.width} / ${aspectRatio.value.height}`
  })

  // Actions
  function setGridSize(newRows: number, newCols: number) {
    rows.value = Math.min(4, Math.max(2, newRows))
    columns.value = Math.min(4, Math.max(2, newCols))
    cells.value = createInitialCells(rows.value, columns.value)
    rowHeights.value = createEqualSizes(rows.value)
    columnWidths.value = createEqualSizes(columns.value)
  }

  function setRows(newRows: number) {
    setGridSize(newRows, columns.value)
  }

  function setColumns(newCols: number) {
    setGridSize(rows.value, newCols)
  }

  function deleteCell(cellId: string) {
    const cellIndex = cells.value.findIndex((c) => c.id === cellId)
    if (cellIndex === -1) return

    const cellToDelete = cells.value[cellIndex]
    if (!cellToDelete) return

    const { col, row, rowSpan } = cellToDelete

    // Find cell below in the same column that can expand
    const cellBelow = cells.value.find(
      (c) => c.col === col && c.row === row + rowSpan && c.id !== cellId,
    )

    if (cellBelow) {
      // Expand the cell below to take the deleted cell's space
      cellBelow.row = row
      cellBelow.rowSpan += rowSpan
    } else {
      // Find cell above to expand downward
      const cellAbove = cells.value.find(
        (c) => c.col === col && c.row + c.rowSpan === row && c.id !== cellId,
      )

      if (cellAbove) {
        cellAbove.rowSpan += rowSpan
      }
    }

    // Remove the deleted cell
    cells.value = cells.value.filter((c) => c.id !== cellId)
  }

  function updateCellImage(cellId: string, file: File | null, url: string | null) {
    const cell = cells.value.find((c) => c.id === cellId)
    if (cell) {
      cell.imageFile = file
      cell.imageUrl = url
      cell.imagePosition = { x: 50, y: 50 } // Reset position when changing image
    }
  }

  function updateCellImagePosition(cellId: string, x: number, y: number) {
    const cell = cells.value.find((c) => c.id === cellId)
    if (cell) {
      cell.imagePosition = {
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
      }
    }
  }

  function updateRowHeight(index: number, delta: number) {
    if (index < 0 || index >= rowHeights.value.length - 1) return

    const minSize = 10 // Minimum 10% for any row
    const currentHeight = rowHeights.value[index] ?? 0
    const nextHeight = rowHeights.value[index + 1] ?? 0

    const newCurrentHeight = Math.max(minSize, Math.min(100 - minSize, currentHeight + delta))
    const newNextHeight = nextHeight - (newCurrentHeight - currentHeight)

    if (newNextHeight >= minSize) {
      rowHeights.value[index] = newCurrentHeight
      rowHeights.value[index + 1] = newNextHeight
    }
  }

  function updateColumnWidth(index: number, delta: number) {
    if (index < 0 || index >= columnWidths.value.length - 1) return

    const minSize = 10 // Minimum 10% for any column
    const currentWidth = columnWidths.value[index] ?? 0
    const nextWidth = columnWidths.value[index + 1] ?? 0

    const newCurrentWidth = Math.max(minSize, Math.min(100 - minSize, currentWidth + delta))
    const newNextWidth = nextWidth - (newCurrentWidth - currentWidth)

    if (newNextWidth >= minSize) {
      columnWidths.value[index] = newCurrentWidth
      columnWidths.value[index + 1] = newNextWidth
    }
  }

  function setAspectRatio(ratio: AspectRatio) {
    aspectRatio.value = ratio
  }

  function updateGridLines(settings: Partial<GridLineSettings>) {
    gridLines.value = { ...gridLines.value, ...settings }
  }

  function resetGrid() {
    rows.value = 3
    columns.value = 3
    cells.value = createInitialCells(3, 3)
    rowHeights.value = createEqualSizes(3)
    columnWidths.value = createEqualSizes(3)
    aspectRatio.value = ASPECT_RATIO_PRESETS[0] ?? DEFAULT_ASPECT_RATIO
    gridLines.value = {
      showInnerLines: true,
      showEdges: true,
      thickness: 2,
      color: '#000000',
    }
  }

  return {
    // State
    rows,
    columns,
    cells,
    rowHeights,
    columnWidths,
    aspectRatio,
    gridLines,
    // Computed
    gridTemplateRows,
    gridTemplateColumns,
    aspectRatioValue,
    // Actions
    setGridSize,
    setRows,
    setColumns,
    deleteCell,
    updateCellImage,
    updateCellImagePosition,
    updateRowHeight,
    updateColumnWidth,
    setAspectRatio,
    updateGridLines,
    resetGrid,
  }
})
