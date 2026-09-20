const photos: Array<[RegExp, string]> = [
  [/artemis/i, '/wine-products/artemis-2021.webp'],
  [/tignanello/i, '/wine-products/tignanello-2020.webp'],
  [/gran reserva 904/i, '/wine-products/gran-reserva-904-2015.webp'],
  [/erdener|pr[aä]lat/i, '/wine-products/erdener-pralat-2020.webp'],
  [/alpha m/i, 'https://images.tcdn.com.br/img/img_prod/1053818/vinho_tinto_montes_alpha_m_2020_1083_1_48d0a4f682de94ca31b1c8d3c83854b3.jpg'],
  [/bin 389/i, 'https://redwagonshoppe.com/cdn/shop/files/pen0_ee1570d0-5c0c-4ca9-a7ae-08032fa24381_1200x1200.png?v=1739982102'],
  [/ch[aâ]teauneuf.*pape/i, 'https://www.wine-calais.co.uk/22032-large_default/chateauneuf-du-pape-eguigal-2019-75-cl.jpg'],
  [/evenstad/i, 'https://goodpour.com/cdn/shop/files/domaine-serene-evenstad-reserve-pinot-noir_1080x.png?v=1715679484'],
  [/gevrey.*chambertin/i, 'https://www.vistavin.fr/8198-home_default/serafin-pere-fils-gevrey-chambertin-2020.jpg'],
  [/valbuena/i, 'https://cdn.vineshop24.de/media/09/a3/38/1681468722/1803530-vega-sicilia-valbuena-5-ribera-del-duero-do-2018_2595.jpg?ts=1685253304'],
  [/cantenac brown/i, 'https://img.shoplineapp.com/media/image_clips/695e37523924df38ae416c9b/original.jpg?1767782225=&owner_id=57cd2772617069114cbd0400'],
  [/te koko/i, 'https://www.lbv.dk/cdn/shop/products/cq5dam.web.1280.1280_696095ad-1118-45fc-ae36-b9be0dd0b71a_800x.png?v=1675430750'],
  [/adrianna vineyard/i, 'https://www.xtrawine.com/cdn/shop/files/catena-zapata-adrianna-vineyard-mundus-bacillus-terrae-malbec-2018_32316_1.jpg?v=1773681627'],
  [/barbaresco/i, 'https://winezip.co.kr/cdn/shop/files/ZIPUP41-18_8a329165-2e42-405e-a6b7-b6c5d3b3d543_900x.png?v=1765523423'],
  [/barca velha/i, 'https://www.kwmwine.com/Images/Models/Full/2865.Jpg'],
  [/dom p[eé]rignon/i, 'https://di-vine.com/cdn/shop/files/Dom-Perignon-2013.png?v=1712669254&width=1946'],
  [/opus one/i, 'https://www.sandhamswine.co.uk/images/shop/more/600x600_4820_3519ccd6675085a719f76f67f9922690_17106217552199RB.jpg'],
  [/ruinart.*blanc/i, 'https://paneco-sg-moonshine-production-s3-amazonaws-com.global.ssl.fastly.net/opk9c3yagf0xcodxt4cro0yok7at?auto=webp&format=jpg'],
]

export const GENERIC_WINE_PHOTO = '/wine-products/generic-wine-bottle.jpg'

export function wineProductPhoto(name = ''): string {
  return photos.find(([pattern]) => pattern.test(name))?.[1] || GENERIC_WINE_PHOTO
}
