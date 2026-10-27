import type { BattlefieldSetup } from '../../shared/battlefield'
import { terrainProfile } from '../../shared/terrain'

type ExportDetails = { setup: BattlefieldSetup; missionTitle: string; deployment: string[] }
const label = (n: number) => `${+n.toFixed(2)}″`

export function battlefieldFilename(setup: BattlefieldSetup) {
  const safe = (value: string) => value.replace(/[^a-z0-9_-]/gi, '-')
  return `Black-Sepulchre_${safe(setup.mission)}_${setup.length}x${setup.width}_${safe(setup.terrain.code)}.png`
}

/** Embed text styling only: no external fonts, stylesheets, URLs or HTML screenshots. */
export function standaloneBattlefieldSvg(source: SVGSVGElement) {
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
  const box = source.viewBox.baseVal
  if (!box.width || !box.height) throw new Error('У схемы нет размера для экспорта')
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(box.width * 32))
  clone.setAttribute('height', String(box.height * 32))
  clone.removeAttribute('class')
  clone.removeAttribute('style')
  return new XMLSerializer().serializeToString(clone)
}

/** Export the public starting plan with a legend and a compact construction key. */
export async function battlefieldPng(
  source: SVGSVGElement,
  { setup, missionTitle, deployment }: ExportDetails,
): Promise<Blob> {
  const svg = standaloneBattlefieldSvg(source)
  const box = source.viewBox.baseVal,
    scale = 2000 / Math.max(box.width, box.height)
  const mapWidth = Math.round(box.width * scale),
    mapHeight = Math.round(box.height * scale)
  const padding = 48,
    width = Math.max(mapWidth + padding * 2, 1600),
    header = 160
  const rows = Math.ceil(setup.terrain.pieces.length / 2)
  const footer = 360 + rows * 66 + (setup.legacyI2 ? 44 : 0)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = header + mapHeight + footer
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Браузер не поддерживает создание PNG')
  ctx.fillStyle = '#101712'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#f0e9d8'
  ctx.font = 'bold 42px Arial, sans-serif'
  ctx.fillText('THE BLACK SEPULCHRE', padding, 60)
  ctx.font = '32px Arial, sans-serif'
  ctx.fillText(`${missionTitle} · ${setup.length} × ${setup.width}″`, padding, 106)
  ctx.fillStyle = '#c4c9bb'
  ctx.font = '25px Arial, sans-serif'
  ctx.fillText(
    `Начальная расстановка · схема ${setup.terrain.code} · все размеры в дюймах`,
    padding,
    144,
  )
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Не удалось преобразовать схему в картинку'))
      image.src = url
    })
    ctx.drawImage(image, (width - mapWidth) / 2, header, mapWidth, mapHeight)
  } finally {
    URL.revokeObjectURL(url)
  }
  let y = header + mapHeight + 38
  ctx.fillStyle = '#dddcc9'
  ctx.font = '26px Arial, sans-serif'
  for (const line of deployment) {
    ctx.fillText(line, padding, y)
    y += 38
  }
  y += 16
  const legend = [
    ['#41544b', 'Dense — плотный террейн'],
    ['#655d48', 'Light — лёгкий террейн'],
    ['#f4cb76', 'Золотая граница — цель-область'],
    setup.terrain.pieces.some((p) => p.platforms?.length)
      ? ['#b7e4f4', 'Голубой пунктир — этаж +3″']
      : ['#c9d7bd', 'Светлые линии — физические стены'],
  ]
  legend.forEach(([color, text], i) => {
    const x = padding + (i % 2) * (width / 2),
      rowY = y + Math.floor(i / 2) * 40
    ctx.fillStyle = color
    ctx.fillRect(x, rowY - 23, 24, 24)
    ctx.fillStyle = '#e2e5d9'
    ctx.fillText(text, x + 38, rowY)
  })
  y += 100
  ctx.font = '25px Arial, sans-serif'
  ctx.fillText('Круг — маркер Ø40 мм · ромб — предмет · квадрат — взаимодействие', padding, y)
  y += 52
  ctx.font = 'bold 28px Arial, sans-serif'
  ctx.fillText('ТЕРРЕЙН · размеры областей и этажей', padding, y)
  y += 40
  setup.terrain.pieces.forEach((p, i) => {
    const x = padding + (i % 2) * (width / 2),
      rowY = y + Math.floor(i / 2) * 66,
      profile = terrainProfile(p)
    ctx.fillStyle = '#eee9db'
    ctx.font = '25px Arial, sans-serif'
    ctx.fillText(
      `${p.id} · ${p.kind === 'dense' ? 'Dense' : 'Light'} · ${label(p.width)} × ${label(p.height)}${p.outline ? ' (габариты)' : ''} · высота стен ${label(profile.wallHeight)}`,
      x,
      rowY,
    )
    ctx.fillStyle = '#b8c7bd'
    ctx.font = '23px Arial, sans-serif'
    const floor = p.platforms?.[0]
    ctx.fillText(
      floor
        ? `Этаж ${label(floor.width)} × ${label(floor.height)} на +${label(floor.elevation)}`
        : p.objectiveId
          ? `Вся область — цель ${p.objectiveId}`
          : 'Наземный элемент',
      x,
      rowY + 29,
    )
  })
  if (setup.legacyI2) {
    ctx.fillStyle = '#f4cb76'
    ctx.font = '24px Arial, sans-serif'
    ctx.fillText(
      'Старый бой I2: сохранены исходные позиции и маркеры целей.',
      padding,
      canvas.height - 28,
    )
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
