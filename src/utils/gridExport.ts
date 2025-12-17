import type { GridCell, GridLineSettings, AspectRatio } from '@/types/grid'

interface Size {
  width: number
  height: number
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

// Calculate canvas dimensions from aspect ratio
export function calculateCanvasSize(aspectRatio: AspectRatio, baseSize = 1200): Size {
  const ratio = aspectRatio.width / aspectRatio.height
  if (ratio >= 1) {
    return { width: baseSize, height: baseSize / ratio }
  }
  return { width: baseSize * ratio, height: baseSize }
}

// Convert percentage array to cumulative pixel positions
export function calculatePositions(percentages: number[], totalSize: number): number[] {
  const positions = [0]
  for (const pct of percentages) {
    const last = positions[positions.length - 1] ?? 0
    positions.push(last + (pct / 100) * totalSize)
  }
  return positions
}

// Get cell bounds from grid positions
export function getCellBounds(
  cell: GridCell,
  rowPositions: number[],
  colPositions: number[],
): Rect {
  const x = colPositions[cell.col - 1] ?? 0
  const y = rowPositions[cell.row - 1] ?? 0
  const width = (colPositions[cell.col - 1 + cell.colSpan] ?? 0) - x
  const height = (rowPositions[cell.row - 1 + cell.rowSpan] ?? 0) - y
  return { x, y, width, height }
}

// Calculate image draw bounds with zoom and position (matches GridCell.vue logic)
export function calculateImageDrawBounds(
  cellBounds: Rect,
  imageSize: Size,
  zoom: number,
  position: { x: number; y: number },
): Rect {
  const cellAspect = cellBounds.width / cellBounds.height
  const imageAspect = imageSize.width / imageSize.height

  // Base scale to fill cell (cover behavior)
  const baseScale =
    imageAspect > cellAspect ? cellBounds.height / imageSize.height : cellBounds.width / imageSize.width

  const finalScale = baseScale * zoom
  const width = imageSize.width * finalScale
  const height = imageSize.height * finalScale

  // Position based on focal point (0-100%)
  const x = cellBounds.x + (cellBounds.width - width) * (position.x / 100)
  const y = cellBounds.y + (cellBounds.height - height) * (position.y / 100)

  return { x, y, width, height }
}

// Load image as promise
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

// Draw grid lines on canvas
export function drawGridLines(
  ctx: CanvasRenderingContext2D,
  gridLines: GridLineSettings,
  rowPositions: number[],
  colPositions: number[],
  canvasSize: Size,
): void {
  const { thickness, color, showInnerLines, showEdges } = gridLines
  ctx.strokeStyle = color
  ctx.lineWidth = thickness

  if (showInnerLines) {
    // Vertical lines (skip first and last)
    for (let i = 1; i < colPositions.length - 1; i++) {
      ctx.beginPath()
      ctx.moveTo(colPositions[i]!, 0)
      ctx.lineTo(colPositions[i]!, canvasSize.height)
      ctx.stroke()
    }
    // Horizontal lines (skip first and last)
    for (let i = 1; i < rowPositions.length - 1; i++) {
      ctx.beginPath()
      ctx.moveTo(0, rowPositions[i]!)
      ctx.lineTo(canvasSize.width, rowPositions[i]!)
      ctx.stroke()
    }
  }

  if (showEdges) {
    const offset = thickness / 2
    ctx.strokeRect(offset, offset, canvasSize.width - thickness, canvasSize.height - thickness)
  }
}
