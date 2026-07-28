declare module "opentype.js" {
  interface BoundingBox {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }
  interface Path {
    toSVG(decimalPlaces?: number): string;
    toPathData(options?: { decimalPlaces?: number }): string;
    getBoundingBox(): BoundingBox | null;
  }
  interface Font {
    unitsPerEm: number;
    getPath(text: string, x: number, y: number, fontSize: number): Path;
  }
  export function parse(buffer: Buffer, index?: number): Font;
}