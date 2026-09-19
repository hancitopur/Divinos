import { uploadLabel } from './supabase'
import type { WineType } from './types'

export type WineImageSource = 'open_food_facts' | 'wikimedia_commons'

export interface WineImageResult {
  id: string
  title: string
  subtitle: string
  thumbnailUrl: string
  downloadUrl: string
  source: WineImageSource
  sourceUrl: string
  barcode?: string
  name?: string
  producer?: string
  vintage?: number
  region?: string
  country?: string
  varietal?: string
  type?: WineType
  sizeMl?: number
}

const OFF_ENDPOINTS = [
  'https://world.openfoodfacts.org/cgi/search.pl',
  'https://world.openfoodfacts.net/cgi/search.pl',
]
const COMMONS = 'https://commons.wikimedia.org/w/api.php'

export async function searchWineImages(query: string): Promise<WineImageResult[]> {
  const clean = query.trim().replace(/\s+/g, ' ')
  if (clean.length < 3) return []

  const [off, commons] = await Promise.allSettled([
    searchOpenFoodFacts(clean),
    searchCommons(clean),
  ])

  const results = [
    ...(off.status === 'fulfilled' ? off.value : []),
    ...(commons.status === 'fulfilled' ? commons.value : []),
  ]
  return results.slice(0, 10)
}

async function searchOpenFoodFacts(query: string): Promise<WineImageResult[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '8',
    fields: 'code,product_name,generic_name,brands,image_front_url,image_front_small_url,countries,countries_tags,origins,origins_tags,categories,categories_tags,quantity,product_quantity,product_quantity_unit',
  })
  let response: Response | null = null
  for (const endpoint of OFF_ENDPOINTS) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8000)
    try {
      const attempt = await fetch(`${endpoint}?${params}`, { signal: controller.signal })
      if (attempt.ok) { response = attempt; break }
    } catch { /* try the official mirror */ } finally { window.clearTimeout(timeout) }
  }
  if (!response) throw new Error('Open Food Facts no está disponible')
  const data = await response.json() as { products?: any[] }
  return (data.products ?? [])
    .filter((p) => p.image_front_url || p.image_front_small_url)
    .map((p) => {
      const rawName = cleanText(p.product_name) || cleanText(p.generic_name) || cleanText(p.brands) || 'Vino sin nombre'
      const vintage = parseVintage(`${rawName} ${p.generic_name || ''}`)
      const name = stripVintage(rawName, vintage)
      const producer = cleanText(String(p.brands || '').split(',')[0])
      const country = firstValue(p.countries, p.countries_tags)
      const region = firstValue(p.origins, p.origins_tags)
      const searchable = [name, p.generic_name, p.categories, ...(p.categories_tags || [])].filter(Boolean).join(' ')
      return {
        id: `off-${p.code}`,
        title: name,
        subtitle: [producer, region, country].filter(Boolean).join(' · '),
        thumbnailUrl: p.image_front_small_url || p.image_front_url,
        downloadUrl: p.image_front_url || p.image_front_small_url,
        source: 'open_food_facts' as const,
        sourceUrl: `https://world.openfoodfacts.org/product/${encodeURIComponent(p.code)}`,
        barcode: cleanText(p.code),
        name,
        producer,
        vintage,
        region,
        country,
        varietal: detectVarietal(searchable),
        type: detectWineType(searchable),
        sizeMl: parseSizeMl(p.quantity, p.product_quantity, p.product_quantity_unit),
      }
    })
}

async function searchCommons(query: string): Promise<WineImageResult[]> {
  const params = new URLSearchParams({
    action: 'query', generator: 'search', gsrsearch: `intitle:"${query}" wine bottle`,
    gsrnamespace: '6', gsrlimit: '8', prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata', iiurlwidth: '500', format: 'json', origin: '*',
  })
  const response = await fetch(`${COMMONS}?${params}`)
  if (!response.ok) throw new Error(`Wikimedia Commons ${response.status}`)
  const data = await response.json() as { query?: { pages?: Record<string, any> } }
  return Object.values(data.query?.pages ?? {})
    .map((page: any) => ({ page, info: page.imageinfo?.[0] }))
    .filter(({ info }) => info?.mime?.startsWith('image/') && info?.thumburl && info?.url)
    .map(({ page, info }) => {
      const title = String(page.title || '').replace(/^File:/, '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
      const vintage = parseVintage(title)
      return {
        id: `commons-${page.pageid}`,
        title,
        subtitle: 'Wikimedia Commons · imagen con licencia abierta',
        thumbnailUrl: info.thumburl,
        downloadUrl: info.thumburl,
        source: 'wikimedia_commons' as const,
        sourceUrl: info.descriptionurl,
        name: stripVintage(title, vintage),
        vintage,
        varietal: detectVarietal(title),
        type: detectWineType(title),
        sizeMl: parseSizeMl(title),
      }
    })
}

function cleanText(value: unknown): string | undefined {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ')
  return text || undefined
}

function humanizeTag(value: string): string {
  const raw = value.replace(/^[a-z]{2}:/i, '').replace(/[-_]+/g, ' ').trim()
  return raw ? raw.replace(/\b\w/g, (letter) => letter.toUpperCase()) : ''
}

function firstValue(label: unknown, tags: unknown): string | undefined {
  const direct = cleanText(String(label ?? '').split(',')[0])
  if (direct) return direct
  const firstTag = Array.isArray(tags) ? cleanText(tags[0]) : undefined
  return firstTag ? humanizeTag(firstTag) : undefined
}

function parseVintage(value: string): number | undefined {
  const years = value.match(/\b(?:19|20)\d{2}\b/g)
  if (!years?.length) return undefined
  const year = Number(years[years.length - 1])
  const current = new Date().getFullYear()
  return year >= 1900 && year <= current ? year : undefined
}

function stripVintage(value: string, vintage?: number): string {
  if (!vintage) return value
  const cleaned = value.replace(new RegExp(`\\b${vintage}\\b`, 'g'), '').replace(/\s{2,}/g, ' ').replace(/[\s,·-]+$/, '').trim()
  return cleaned || value
}

function parseSizeMl(quantity?: unknown, amount?: unknown, unit?: unknown): number | undefined {
  const text = cleanText(quantity)
  const match = text?.match(/(\d+(?:[.,]\d+)?)\s*(ml|cl|l)\b/i)
  if (match) {
    const value = Number(match[1].replace(',', '.'))
    const factor = match[2].toLowerCase() === 'l' ? 1000 : match[2].toLowerCase() === 'cl' ? 10 : 1
    const ml = Math.round(value * factor)
    return ml >= 50 && ml <= 20000 ? ml : undefined
  }
  const numeric = Number(amount)
  const normalizedUnit = String(unit ?? '').toLowerCase()
  if (Number.isFinite(numeric) && numeric > 0) {
    const ml = normalizedUnit === 'l' ? numeric * 1000 : normalizedUnit === 'cl' ? numeric * 10 : numeric
    return ml >= 50 && ml <= 20000 ? Math.round(ml) : undefined
  }
  return undefined
}

function detectWineType(value: string): WineType | undefined {
  const text = value.toLowerCase()
  if (/sparkling|champagne|prosecco|espumoso|mousseux/.test(text)) return 'sparkling'
  if (/ros[eé]|rosado/.test(text)) return 'rose'
  if (/dessert|sweet wine|vin doux|vino dulce/.test(text)) return 'dessert'
  if (/fortified|port wine|porto|sherry|jerez|madeira/.test(text)) return 'fortified'
  if (/white wine|vino blanco|vin blanc/.test(text)) return 'white'
  if (/red wine|vino tinto|vin rouge/.test(text)) return 'red'
  return undefined
}

function detectVarietal(value: string): string | undefined {
  const candidates: Array<[RegExp, string]> = [
    [/cabernet sauvignon/i, 'Cabernet Sauvignon'], [/sauvignon blanc/i, 'Sauvignon Blanc'],
    [/pinot noir/i, 'Pinot Noir'], [/pinot grigio|pinot gris/i, 'Pinot Grigio'],
    [/chardonnay/i, 'Chardonnay'], [/tempranillo/i, 'Tempranillo'], [/malbec/i, 'Malbec'],
    [/merlot/i, 'Merlot'], [/syrah|shiraz/i, 'Syrah'], [/riesling/i, 'Riesling'],
    [/sangiovese/i, 'Sangiovese'], [/nebbiolo/i, 'Nebbiolo'], [/zinfandel/i, 'Zinfandel'],
    [/grenache|garnacha/i, 'Grenache'], [/moscato|muscat/i, 'Moscato'],
    [/chenin blanc/i, 'Chenin Blanc'], [/viognier/i, 'Viognier'],
  ]
  return candidates.find(([pattern]) => pattern.test(value))?.[1]
}

export async function importWineImage(result: WineImageResult): Promise<string> {
  const url = new URL(result.downloadUrl)
  const allowed = ['images.openfoodfacts.org', 'images.openfoodfacts.net', 'upload.wikimedia.org', 'thumb.wikimedia.org']
  if (url.protocol !== 'https:' || !allowed.includes(url.hostname)) throw new Error('Fuente de imagen no permitida')

  const response = await fetch(url.toString())
  if (!response.ok) throw new Error(`No se pudo descargar la imagen (${response.status})`)
  const type = response.headers.get('content-type') || 'image/jpeg'
  if (!type.startsWith('image/')) throw new Error('El resultado no es una imagen válida')
  const blob = await response.blob()
  if (blob.size > 12 * 1024 * 1024) throw new Error('La imagen excede 12 MB')
  const file = new File([blob], 'wine-label.jpg', { type })
  return uploadLabel(file, 'wines')
}
