interface ProductPriceLike {
  price?: number | null
  selling_price?: number | null
  starting_price?: number | null
}

const FALLBACK_STOREFRONT_MARKUP = 1.05

export function getProductSellingPrice (product: ProductPriceLike): number {
  if (
    typeof product.selling_price === 'number' &&
    Number.isFinite(product.selling_price) &&
    product.selling_price >= 0
  ) {
    return Math.round(product.selling_price)
  }

  const capital = product.price
  if (typeof capital !== 'number' || !Number.isFinite(capital) || capital < 0) {
    return 0
  }

  // Compatibility for a frontend deployed briefly before the updated backend.
  return Math.round(Math.round(capital) * FALLBACK_STOREFRONT_MARKUP)
}

export function getProductStartingPrice (product: ProductPriceLike): number {
  if (
    typeof product.starting_price === 'number' &&
    Number.isFinite(product.starting_price) &&
    product.starting_price >= 0
  ) {
    return Math.round(product.starting_price)
  }

  return getProductSellingPrice(product)
}
