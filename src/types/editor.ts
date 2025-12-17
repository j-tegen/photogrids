import type { Rotation, CropArea } from './splitter'

export interface Adjustments {
  exposure: number      // -100 to 100
  saturation: number    // -100 to 100
  brilliance: number    // -100 to 100
  shadows: number       // -100 to 100
  sharpness: number     // 0 to 100
}

export interface CurvePoint {
  x: number  // 0-255
  y: number  // 0-255
}

export interface ColorCurves {
  rgb: CurvePoint[]
  red: CurvePoint[]
  green: CurvePoint[]
  blue: CurvePoint[]
}

export type CurveChannel = 'rgb' | 'red' | 'green' | 'blue'

// Shared geometry types
export interface Point2D {
  x: number
  y: number
}

export type CropDragType = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export interface FilterSettings {
  vintage: number       // 0-100
  blackAndWhite: number // 0-100
  sepia: number         // 0-100
  warm: number          // 0-100
  cool: number          // 0-100
  fade: number          // 0-100
  vignette: number      // 0-100
  grain: number         // 0-100
  blur: number          // 0-100
  invert: number        // 0-100
  posterize: number     // 0-100
}

export type FilterName = keyof FilterSettings

export interface EditorTransforms {
  rotation: Rotation
  zoom: number
  position: Point2D
  cropArea: CropArea
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  exposure: 0,
  saturation: 0,
  brilliance: 0,
  shadows: 0,
  sharpness: 0,
}

export const DEFAULT_CURVES: ColorCurves = {
  rgb: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
  red: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
  green: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
  blue: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
}

export const DEFAULT_FILTERS: FilterSettings = {
  vintage: 0,
  blackAndWhite: 0,
  sepia: 0,
  warm: 0,
  cool: 0,
  fade: 0,
  vignette: 0,
  grain: 0,
  blur: 0,
  invert: 0,
  posterize: 0,
}

export const FILTER_LABELS: Record<FilterName, string> = {
  vintage: 'Vintage',
  blackAndWhite: 'B&W',
  sepia: 'Sepia',
  warm: 'Warm',
  cool: 'Cool',
  fade: 'Fade',
  vignette: 'Vignette',
  grain: 'Grain',
  blur: 'Blur',
  invert: 'Invert',
  posterize: 'Posterize',
}
