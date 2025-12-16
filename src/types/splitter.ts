export interface CropArea {
  x: number // % from left (0-100)
  y: number // % from top (0-100)
  width: number // % of image width (0-100)
  height: number // % of image height (0-100)
}

export interface Position {
  x: number // % offset (-100 to 100)
  y: number // % offset (-100 to 100)
}

export type Rotation = 0 | 90 | 180 | 270

export const MIN_SPLIT_COUNT = 2
export const MAX_SPLIT_COUNT = 5
export const DEFAULT_SPLIT_COUNT = 2

export const MIN_ZOOM = 1
export const MAX_ZOOM = 3
export const DEFAULT_ZOOM = 1
