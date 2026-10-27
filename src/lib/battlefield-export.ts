import type { BattlefieldSetup } from '../../shared/battlefield'

type BoardSize = Pick<BattlefieldSetup, 'length' | 'width'>
const pixelsPerInch = 64

export function battlefieldFilename(setup: BattlefieldSetup) {
  const safe = (value: string) => value.replace(/[^a-z0-9_-]/gi, '-')
  return `Black-Sepulchre_${safe(setup.mission)}_${setup.length}x${setup.width}_${safe(setup.terrain.code)}.png`
}

/** Crop to the playing surface; embed text styling without external fonts or HTML. */
export function standaloneBattlefieldSvg(source: SVGSVGElement, board: BoardSize) {
  if (![board.length, board.width].every((n) => Number.isFinite(n) && n > 0))
    throw new Error('У схемы нет размера для экспорта')
  const clone = source.cloneNode(true) as SVGSVGElement
  const texts = clone.querySelectorAll('text')
  source.querySelectorAll('text').forEach((text, i) => {
    const style = getComputedStyle(text)
    for (const property of [
      'fill',
      'font-family',
      'font-size',
      'font-weight',
      'font-style',
      'stroke',
      'stroke-width',
      'paint-order',
    ])
      texts[i].style.setProperty(property, style.getPropertyValue(property))
  })
  clone.querySelectorAll('[data-export-ignore]').forEach((node) => node.remove())
  clone.querySelectorAll('*').forEach((node) => {
    for (const attr of ['tabindex', 'role', 'aria-haspopup', 'aria-controls'])
      node.removeAttribute(attr)
  })
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('viewBox', `0 0 ${board.length} ${board.width}`)
  clone.setAttribute('width', String(board.length * pixelsPerInch))
  clone.setAttribute('height', String(board.width * pixelsPerInch))
  clone.removeAttribute('class')
  clone.removeAttribute('style')
  return new XMLSerializer().serializeToString(clone)
}

/** A map-only PNG with the board's exact aspect ratio, suitable as a setup underlay. */
export async function battlefieldPng(source: SVGSVGElement, board: BoardSize): Promise<Blob> {
  const svg = standaloneBattlefieldSvg(source, board)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(board.length * pixelsPerInch)
  canvas.height = Math.round(board.width * pixelsPerInch)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Браузер не поддерживает создание PNG')
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Не удалось преобразовать схему в картинку'))
      image.src = url
    })
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  } finally {
    URL.revokeObjectURL(url)
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Не удалось подготовить PNG'))),
      'image/png',
    ),
  )
}

export function downloadBattlefield(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
}
