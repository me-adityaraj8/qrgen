/**
 * Typed access to two internal helpers of the `qrcode` package, which ships
 * them without type declarations. Pinned by the qrcode version in package.json.
 */
// @ts-expect-error -- untyped internal module
import { getSymbolTotalCodewords as totalCodewords } from 'qrcode/lib/core/utils'
// @ts-expect-error -- untyped internal module
import { getPositions as alignmentPositions } from 'qrcode/lib/core/alignment-pattern'

/** Data plus error-correction codewords for a QR version (1–40). */
export const getSymbolTotalCodewords: (version: number) => number = totalCodewords

/** Centre [row, col] of every alignment pattern for a QR version. */
export const getAlignmentPositions: (version: number) => [number, number][] = alignmentPositions
