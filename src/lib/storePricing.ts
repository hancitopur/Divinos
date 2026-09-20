export const SERVICE_FEE_RATE = 0.075
export const PUBLIC_PRICE_FACTOR = 1.15

const cents = (amount: number) => Math.round((Number(amount) + Number.EPSILON) * 100) / 100

export function storePrices(basePrice: number) {
  const base = Number(basePrice) || 0
  const member = cents(base * (1 + SERVICE_FEE_RATE))
  const publicPrice = cents(base * PUBLIC_PRICE_FACTOR * (1 + SERVICE_FEE_RATE))
  return { member, public: publicPrice }
}
