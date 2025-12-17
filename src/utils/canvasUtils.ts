import type { ColorCurves, Adjustments, FilterSettings } from '@/types/editor'
import { generateLUT } from './curveUtils'

/**
 * Apply a CSS filter string to a canvas using a temp canvas.
 * Drawing a canvas onto itself with ctx.filter doesn't work reliably in browsers.
 */
export function applyCanvasFilter(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  filterString: string
): void {
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = canvas.width
  tempCanvas.height = canvas.height
  const tempCtx = tempCanvas.getContext('2d')!

  tempCtx.filter = filterString
  tempCtx.drawImage(canvas, 0, 0)

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(tempCanvas, 0, 0)
}

/**
 * Apply color curves to canvas via pixel manipulation.
 */
export function applyCurvesToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  curves: ColorCurves
): void {
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  const rgbLut = generateLUT(curves.rgb)
  const rLut = generateLUT(curves.red)
  const gLut = generateLUT(curves.green)
  const bLut = generateLUT(curves.blue)

  for (let i = 0; i < data.length; i += 4) {
    const rVal = data[i] ?? 0
    const gVal = data[i + 1] ?? 0
    const bVal = data[i + 2] ?? 0

    // Apply RGB curve first, then individual channel curves
    const r = Math.round((rgbLut[rVal] ?? 0.5) * 255)
    const g = Math.round((rgbLut[gVal] ?? 0.5) * 255)
    const b = Math.round((rgbLut[bVal] ?? 0.5) * 255)

    data[i] = Math.round((rLut[Math.min(255, Math.max(0, r))] ?? 0.5) * 255)
    data[i + 1] = Math.round((gLut[Math.min(255, Math.max(0, g))] ?? 0.5) * 255)
    data[i + 2] = Math.round((bLut[Math.min(255, Math.max(0, b))] ?? 0.5) * 255)
  }

  ctx.putImageData(imageData, 0, 0)
}

/**
 * Apply posterize effect via pixel manipulation.
 * @param intensity - Value from 0-100
 */
export function applyPosterizeEffect(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number
): void {
  if (intensity <= 0) return

  const levels = Math.max(2, Math.round(16 - (intensity / 100) * 14))
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    const rVal = data[i] ?? 0
    const gVal = data[i + 1] ?? 0
    const bVal = data[i + 2] ?? 0

    data[i] = (Math.round((rVal / 255) * levels) / levels) * 255
    data[i + 1] = (Math.round((gVal / 255) * levels) / levels) * 255
    data[i + 2] = (Math.round((bVal / 255) * levels) / levels) * 255
  }

  ctx.putImageData(imageData, 0, 0)
}

/**
 * Apply grain effect via pixel manipulation.
 * @param intensity - Value from 0-100
 * @param scaleFactor - Scale factor for resolution-dependent grain
 */
export function applyGrainEffect(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
  scaleFactor = 1
): void {
  if (intensity <= 0) return

  const normalizedIntensity = intensity / 100
  // Scale grain with sqrt of resolution factor for perceptually similar effect
  const grainScale = Math.sqrt(scaleFactor)
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * normalizedIntensity * 100 * grainScale
    const rVal = data[i] ?? 0
    const gVal = data[i + 1] ?? 0
    const bVal = data[i + 2] ?? 0

    data[i] = Math.min(255, Math.max(0, rVal + noise))
    data[i + 1] = Math.min(255, Math.max(0, gVal + noise))
    data[i + 2] = Math.min(255, Math.max(0, bVal + noise))
  }

  ctx.putImageData(imageData, 0, 0)
}

/**
 * Apply vignette as radial gradient overlay.
 * @param intensity - Value from 0-100
 */
export function applyVignetteEffect(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number
): void {
  if (intensity <= 0) return

  const normalizedIntensity = intensity / 100
  const centerX = width / 2
  const centerY = height / 2
  const radius = Math.max(width, height) * 0.5

  const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.3, centerX, centerY, radius)
  gradient.addColorStop(0, 'rgba(0,0,0,0)')
  gradient.addColorStop(1, `rgba(0,0,0,${normalizedIntensity * 0.7})`)

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}

/**
 * Build CSS filter string from adjustments and filters.
 * Used by both preview (cssFilterStyle) and export (handleExport).
 */
export function buildCssFilterString(
  adjustments: Adjustments,
  filters: FilterSettings,
  options?: { scaleFactor?: number }
): string {
  const filterParts: string[] = []
  const scaleFactor = options?.scaleFactor ?? 1

  // Basic adjustments
  if (adjustments.exposure !== 0) {
    filterParts.push(`brightness(${1 + adjustments.exposure / 100})`)
  }
  if (adjustments.saturation !== 0) {
    filterParts.push(`saturate(${1 + adjustments.saturation / 100})`)
  }
  if (adjustments.brilliance !== 0) {
    filterParts.push(`contrast(${1 + adjustments.brilliance / 100})`)
  }
  if (adjustments.shadows !== 0) {
    filterParts.push(`brightness(${1 + adjustments.shadows / 200})`)
  }

  // Standard filters
  if (filters.invert > 0) {
    filterParts.push(`invert(${filters.invert / 100})`)
  }
  if (filters.sepia > 0) {
    filterParts.push(`sepia(${filters.sepia / 100})`)
  }
  if (filters.blackAndWhite > 0) {
    filterParts.push(`grayscale(${filters.blackAndWhite / 100})`)
  }

  // Vintage - sepia + desaturate + contrast reduction
  if (filters.vintage > 0) {
    const intensity = filters.vintage / 100
    filterParts.push(`sepia(${intensity * 0.4})`)
    filterParts.push(`saturate(${1 - intensity * 0.2})`)
    filterParts.push(`contrast(${1 - intensity * 0.1})`)
  }

  // Warm - sepia tint + saturation boost
  if (filters.warm > 0) {
    const intensity = filters.warm / 100
    filterParts.push(`sepia(${intensity * 0.3})`)
    filterParts.push(`saturate(${1 + intensity * 0.2})`)
    filterParts.push(`brightness(${1 + intensity * 0.05})`)
  }

  // Cool - hue shift + desaturate
  if (filters.cool > 0) {
    const intensity = filters.cool / 100
    filterParts.push(`saturate(${1 - intensity * 0.2})`)
    filterParts.push(`hue-rotate(${intensity * 15}deg)`)
    filterParts.push(`brightness(${1 - intensity * 0.05})`)
  }

  // Fade - reduced contrast + lifted blacks
  if (filters.fade > 0) {
    const intensity = filters.fade / 100
    filterParts.push(`contrast(${1 - intensity * 0.3})`)
    filterParts.push(`brightness(${1 + intensity * 0.1})`)
  }

  // Blur - scale with resolution for exports
  if (filters.blur > 0) {
    filterParts.push(`blur(${(filters.blur / 10) * scaleFactor}px)`)
  }

  return filterParts.join(' ')
}
