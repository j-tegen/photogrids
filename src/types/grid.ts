export interface ImagePosition {
  x: number // Percentage (0-100)
  y: number // Percentage (0-100)
}

export interface GridCell {
  id: string
  row: number // Starting row (1-based for CSS Grid)
  col: number // Starting column (1-based for CSS Grid)
  rowSpan: number // Number of rows this cell spans
  colSpan: number // Number of columns this cell spans
  imageUrl: string | null
  imageFile: File | null
  imagePosition: ImagePosition
}

export interface GridLineSettings {
  showInnerLines: boolean
  showEdges: boolean
  thickness: number // in pixels (1-10)
  color: string // hex color
}

export interface AspectRatio {
  width: number
  height: number
  label: string // e.g., "16:9", "4:3", "1:1"
}

export const ASPECT_RATIO_PRESETS: AspectRatio[] = [
  { width: 1, height: 1, label: '1:1' },
  { width: 4, height: 3, label: '4:3' },
  { width: 3, height: 2, label: '3:2' },
  { width: 16, height: 9, label: '16:9' },
  { width: 9, height: 16, label: '9:16' },
  { width: 3, height: 4, label: '3:4' },
]
