const MAGIC_APPEND = new Uint8Array([0x53, 0x54, 0x45, 0x47])

export type CarrierFormat = "PNG" | "JPEG" | "BMP" | "GIF" | "WAV" | "MP3" | "MP4" | "PDF" | "UNKNOWN"

export interface WavDataChunk {
  offset: number
  size: number
}

export function detectFormat(filename: string, magic: Uint8Array): CarrierFormat {
  if (magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4e && magic[3] === 0x47) return "PNG"
  if (magic[0] === 0xff && magic[1] === 0xd8) return "JPEG"
  if (magic[0] === 0x42 && magic[1] === 0x4d) return "BMP"
  if (magic[0] === 0x47 && magic[1] === 0x49 && magic[2] === 0x46) return "GIF"
  if (magic[0] === 0x52 && magic[1] === 0x49 && magic[2] === 0x46 && magic[3] === 0x46) return "WAV"
  const ext = filename.split(".").pop()?.toUpperCase()
  if (ext === "MP3") return "MP3"
  if (ext === "MP4" || ext === "M4V" || ext === "MOV") return "MP4"
  if (ext === "PDF") return "PDF"
  return "UNKNOWN"
}

export function canUseSpatialLsb(format: CarrierFormat): boolean {
  return format === "PNG" || format === "BMP" || format === "GIF" || format === "WAV"
}

export function parseWavDataChunk(data: Uint8Array): WavDataChunk | null {
  if (data.length < 12) return null
  const riff = String.fromCharCode(...data.slice(0, 4))
  const wave = String.fromCharCode(...data.slice(8, 12))
  if (riff !== "RIFF" || wave !== "WAVE") return null
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength)
  let offset = 12
  while (offset + 8 <= data.length) {
    const chunkId = String.fromCharCode(...data.slice(offset, offset + 4))
    const chunkSize = dv.getUint32(offset + 4, true)
    if (chunkId === "data") {
      return { offset: offset + 8, size: chunkSize }
    }
    offset += 8 + chunkSize
    if (chunkSize % 2 !== 0) offset++
  }
  return null
}

export function embedAppendSteno(data: Uint8Array, payload: Uint8Array): Uint8Array {
  const len = payload.length
  const header = new Uint8Array(4)
  header[0] = (len >> 24) & 0xff
  header[1] = (len >> 16) & 0xff
  header[2] = (len >> 8) & 0xff
  header[3] = len & 0xff
  const out = new Uint8Array(data.length + MAGIC_APPEND.length + 4 + len)
  out.set(data)
  out.set(MAGIC_APPEND, data.length)
  out.set(header, data.length + MAGIC_APPEND.length)
  out.set(payload, data.length + MAGIC_APPEND.length + 4)
  return out
}

export interface WavHeaderInfo {
  sampleRate: number
  bitDepth: number
  channels: number
  dataSize: number
  duration: number
}

export function parseWavHeader(data: Uint8Array): WavHeaderInfo | null {
  if (data.length < 44) return null
  const riff = String.fromCharCode(...data.slice(0, 4))
  const wave = String.fromCharCode(...data.slice(8, 12))
  if (riff !== "RIFF" || wave !== "WAVE") return null
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength)
  let offset = 12
  let sampleRate = 0
  let bitDepth = 0
  let channels = 0
  let dataSize = 0
  while (offset + 8 <= data.length) {
    const chunkId = String.fromCharCode(...data.slice(offset, offset + 4))
    const chunkSize = dv.getUint32(offset + 4, true)
    if (chunkId === "fmt ") {
      const audioFormat = dv.getUint16(offset + 8, true)
      if (audioFormat !== 1) return null
      channels = dv.getUint16(offset + 10, true)
      sampleRate = dv.getUint32(offset + 12, true)
      bitDepth = dv.getUint16(offset + 22, true)
    } else if (chunkId === "data") {
      dataSize = chunkSize
    }
    offset += 8 + chunkSize
    if (chunkSize % 2 !== 0) offset++
  }
  if (!sampleRate || dataSize === 0) return null
  const bytesPerSample = Math.max(1, bitDepth / 8)
  const totalSamples = dataSize / (bytesPerSample * channels)
  return {
    sampleRate,
    bitDepth,
    channels,
    dataSize,
    duration: totalSamples / sampleRate,
  }
}

export function computeEntropy(data: Uint8Array): number {
  if (data.length === 0) return 0
  const hist = new Array(256).fill(0)
  for (const b of data) hist[b]++
  const total = data.length
  let entropy = 0
  for (let i = 0; i < 256; i++) {
    if (hist[i] > 0) {
      const p = hist[i] / total
      entropy -= p * Math.log2(p)
    }
  }
  return entropy
}

export function computeLsbRatio(data: Uint8Array): number {
  if (data.length === 0) return 0.5
  let ones = 0
  for (const b of data) {
    if (b & 1) ones++
  }
  return ones / data.length
}

export function computeLsbCapacity(dataLength: number, isImage: boolean): number {
  const usable = isImage ? Math.floor(dataLength * 3 / 4) : dataLength
  const encryptionOverhead = 36
  return Math.max(0, Math.floor((usable - 4 - encryptionOverhead) / 1))
}

export function computeChiSquare(data: Uint8Array): number {
  if (data.length < 512) return 0
  const pairsOfValues = 128
  const even = new Array(pairsOfValues).fill(0)
  const odd = new Array(pairsOfValues).fill(0)
  const sampleLimit = Math.min(data.length, 500000)
  const step = Math.max(2, Math.floor(data.length / 50000))
  for (let i = 0; i < sampleLimit; i += step * 2) {
    const idx = i % 2 === 0 ? i : i - 1
    if (idx + 1 >= data.length) break
    const val = data[idx]
    const pof = val >> 1
    if (pof < pairsOfValues) {
      if (val % 2 === 0) even[pof]++
      else odd[pof]++
    }
  }
  let chiSquare = 0
  for (let i = 0; i < pairsOfValues; i++) {
    const expected = (even[i] + odd[i]) / 2
    if (expected > 0) {
      chiSquare += (even[i] - expected) ** 2 / expected
    }
  }
  const degreesOfFreedom = pairsOfValues - 1
  const pValue = Math.min(1, chiSquare / (degreesOfFreedom * 2))
  return 1 - pValue
}

export function detectAppendMarker(data: Uint8Array): { present: boolean; trailingBytes: number } {
  const maxSearch = Math.min(data.length, 10 * 1024 * 1024)
  for (let i = data.length - 1; i >= 0; i--) {
    if (
      i + MAGIC_APPEND.length <= data.length &&
      data[i] === MAGIC_APPEND[0] && data[i + 1] === MAGIC_APPEND[1] &&
      data[i + 2] === MAGIC_APPEND[2] && data[i + 3] === MAGIC_APPEND[3]
    ) {
      return { present: true, trailingBytes: data.length - i }
    }
    if (data.length - i > maxSearch) break
  }
  return { present: false, trailingBytes: 0 }
}

export async function imageToPixels(file: File): Promise<{ pixels: Uint8Array; width: number; height: number }> {
  let bitmap: ImageBitmap | null = null
  try {
    // colorSpaceConversion: 'none' prevents browser color profiles from altering pixel values
    bitmap = await createImageBitmap(file, { resizeQuality: "high", colorSpaceConversion: "none" } as any)
  } catch {
    const ext = file.name.split(".").pop()?.toLowerCase() || "unknown"
    throw new Error(`Cannot decode image (${ext}). The file may be corrupted or in an unsupported format.`)
  }
  const canvas = document.createElement("canvas")
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext("2d", { colorSpace: "srgb", willReadFrequently: true })
  if (!ctx) {
    bitmap.close()
    throw new Error("Canvas 2D context unavailable")
  }
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return {
    pixels: new Uint8Array(imageData.data.buffer as ArrayBuffer, imageData.data.byteOffset, imageData.data.byteLength),
    width: canvas.width,
    height: canvas.height,
  }
}

export function extractAppendSteno(data: Uint8Array): Uint8Array | null {
  for (let i = data.length - 1; i >= 0; i--) {
    if (
      i + MAGIC_APPEND.length <= data.length &&
      data[i] === MAGIC_APPEND[0] &&
      data[i + 1] === MAGIC_APPEND[1] &&
      data[i + 2] === MAGIC_APPEND[2] &&
      data[i + 3] === MAGIC_APPEND[3]
    ) {
      const dv = new DataView(data.buffer, data.byteOffset + i + MAGIC_APPEND.length, 4)
      const len = dv.getUint32(0, false)
      if (i + MAGIC_APPEND.length + 4 + len <= data.length) {
        return data.slice(i + MAGIC_APPEND.length + 4, i + MAGIC_APPEND.length + 4 + len)
      }
      return null
    }
  }
  return null
}
