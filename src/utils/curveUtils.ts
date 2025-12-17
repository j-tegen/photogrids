import type { CurvePoint } from '@/types/editor'

/**
 * Generate a LUT (lookup table) from curve points using linear interpolation.
 * Returns values normalized to 0-1 range for use in canvas operations.
 *
 * @param points - Array of curve points (x: 0-255, y: 0-255)
 * @returns Array of 256 normalized values (0-1)
 */
export function generateLUT(points: CurvePoint[]): number[] {
  const lut = new Array(256)
  if (points.length < 2) return lut.fill(0.5) // Fallback if not enough points

  for (let x = 0; x < 256; x++) {
    // Find the two points this x falls between
    let p1 = points[0]!
    let p2 = points[points.length - 1]!

    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i]!
      const next = points[i + 1]!
      if (x >= curr.x && x <= next.x) {
        p1 = curr
        p2 = next
        break
      }
    }

    // Linear interpolation
    if (p2.x === p1.x) {
      lut[x] = p1.y / 255
    } else {
      const t = (x - p1.x) / (p2.x - p1.x)
      lut[x] = (p1.y + t * (p2.y - p1.y)) / 255
    }
  }

  return lut
}

/**
 * Interpolate curve points and return values in 0-255 range.
 * Used for SVG filter generation and canvas drawing.
 *
 * @param points - Array of curve points (x: 0-255, y: 0-255)
 * @returns Array of 256 integer values (0-255)
 */
export function interpolateCurve(points: CurvePoint[]): number[] {
  if (points.length < 2) return Array(256).fill(128)

  const lut = new Array(256)

  for (let x = 0; x < 256; x++) {
    // Find the two points this x falls between
    let p1 = points[0]!
    let p2 = points[points.length - 1]!

    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i]!
      const next = points[i + 1]!
      if (x >= curr.x && x <= next.x) {
        p1 = curr
        p2 = next
        break
      }
    }

    // Linear interpolation
    if (p2.x === p1.x) {
      lut[x] = p1.y
    } else {
      const t = (x - p1.x) / (p2.x - p1.x)
      lut[x] = Math.round(p1.y + t * (p2.y - p1.y))
    }
  }

  return lut
}

/**
 * Check if a curve has been modified from its default state.
 *
 * @param points - Current curve points
 * @param defaultPoints - Default curve points to compare against
 * @returns true if the curve differs from the default
 */
export function isCurveModified(points: CurvePoint[], defaultPoints: CurvePoint[]): boolean {
  if (points.length !== defaultPoints.length) return true
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    const dp = defaultPoints[i]
    if (!p || !dp) return true
    if (p.x !== dp.x || p.y !== dp.y) {
      return true
    }
  }
  return false
}
