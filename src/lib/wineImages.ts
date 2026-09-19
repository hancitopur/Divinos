import { uploadLabel } from './supabase'

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
}

const OFF = 'https://world.openfoodfacts.org/cgi/search.pl'
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
    fields: 'code,product_name,brands,image_front_url,image_front_small_url,countries',
  })
  const response = await fetch(`${OFF}?${params}`)
  if (!response.ok) throw new Error(`Open Food Facts ${response.status}`)
  const data = await response.json() as { products?: any[] }
  return (data.products ?? [])
    .filter((p) => p.image_front_url || p.image_front_small_url)
    .map((p) => ({
      id: `off-${p.code}`,
      title: p.product_name || p.brands || 'Vino sin nombre',
      subtitle: [p.brands, p.countries].filter(Boolean).join(' · '),
      thumbnailUrl: p.image_front_small_url || p.image_front_url,
      downloadUrl: p.image_front_url || p.image_front_small_url,
      source: 'open_food_facts' as const,
      sourceUrl: `https://world.openfoodfacts.org/product/${encodeURIComponent(p.code)}`,
      barcode: p.code,
    }))
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
    .map(({ page, info }) => ({
      id: `commons-${page.pageid}`,
      title: String(page.title || '').replace(/^File:/, '').replace(/\.[^.]+$/, ''),
      subtitle: 'Wikimedia Commons · imagen con licencia abierta',
      thumbnailUrl: info.thumburl,
      downloadUrl: info.thumburl,
      source: 'wikimedia_commons' as const,
      sourceUrl: info.descriptionurl,
    }))
}

export async function importWineImage(result: WineImageResult): Promise<string> {
  const url = new URL(result.downloadUrl)
  const allowed = ['images.openfoodfacts.org', 'upload.wikimedia.org', 'thumb.wikimedia.org']
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
