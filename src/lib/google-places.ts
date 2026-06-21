import type { NormalizedBusiness, PlacesContext } from '@/types/analysis'

const PLACES_API_BASE = 'https://places.googleapis.com/v1'
const FETCH_TIMEOUT_MS = 8000        // increased from 5s for reliability
const MAX_REVIEW_BUSINESSES = 10     // max businesses to fetch reviews for
const MAX_REVIEWS_PER_BUSINESS = 3
const MAX_REVIEW_CHARS = 250

type PlaceItem = {
  displayName?: { text: string }
  rating?: number
  userRatingCount?: number
  formattedAddress?: string
  types?: string[]
  priceLevel?: string
  id?: string
  internationalPhoneNumber?: string
  websiteUri?: string
}

type PlacesSearchResponse = {
  places?: PlaceItem[]
  nextPageToken?: string
}

type PlaceDetailResponse = {
  reviews?: Array<{
    text?: { text: string }
    rating?: number
  }>
}

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timer)
    return res
  } catch (err) {
    clearTimeout(timer)
    throw err
  }
}

async function searchPlacesPage(
  query: string,
  apiKey: string,
  pageToken?: string
): Promise<PlacesSearchResponse> {
  const body: Record<string, unknown> = {
    textQuery: query,
    languageCode: 'es',
  }
  if (!pageToken) {
    body.maxResultCount = 20
  } else {
    body.pageToken = pageToken
  }

  const res = await fetchWithTimeout(`${PLACES_API_BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.displayName,places.rating,places.userRatingCount,places.formattedAddress,places.types,places.priceLevel,places.id,places.internationalPhoneNumber,places.websiteUri,nextPageToken',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google Places error ${res.status}: ${text}`)
  }

  return res.json()
}

async function searchPlacesAll(query: string, apiKey: string): Promise<PlaceItem[]> {
  const allPlaces: PlaceItem[] = []
  let pageToken: string | undefined

  for (let page = 0; page < 2; page++) {
    try {
      const data = await searchPlacesPage(query, apiKey, page === 0 ? undefined : pageToken)
      allPlaces.push(...(data.places ?? []))
      if (!data.nextPageToken) break
      pageToken = data.nextPageToken
      await new Promise((r) => setTimeout(r, 500))
    } catch (err) {
      if (page === 0) throw err  // first page failure is fatal
      break  // second page failure is non-fatal, return what we have
    }
  }

  return allPlaces
}

async function fetchPlaceReviews(placeId: string, apiKey: string): Promise<string[]> {
  try {
    const res = await fetchWithTimeout(`${PLACES_API_BASE}/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'reviews',
      },
    })
    if (!res.ok) return []
    const data: PlaceDetailResponse = await res.json()
    return (data.reviews ?? [])
      .filter((r) => r.text?.text)
      .slice(0, MAX_REVIEWS_PER_BUSINESS)
      .map((r) => r.text!.text.slice(0, MAX_REVIEW_CHARS))
  } catch {
    return []
  }
}

export function priceLevelFromString(level: string | undefined): number | null {
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  }
  return level !== undefined ? (map[level] ?? null) : null
}

export function calculateAvgRating(ratings: number[]): number {
  if (ratings.length === 0) return 0
  const sum = ratings.reduce((acc, r) => acc + r, 0)
  return Math.round((sum / ratings.length) * 100) / 100
}

export function buildRatingDistribution(ratings: number[]): Record<string, number> {
  const dist: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
  for (const r of ratings) {
    const key = String(Math.floor(r))
    if (key in dist) dist[key]++
  }
  return dist
}

export async function fetchAndNormalizePlaces(
  city: string,
  businessType: string | null,
  apiKey: string
): Promise<PlacesContext> {
  const query = businessType ? `${businessType} en ${city}` : `negocios en ${city}`
  const places = await searchPlacesAll(query, apiKey)

  // Fetch reviews sequentially for up to MAX_REVIEW_BUSINESSES low-rated businesses
  let reviewFetchCount = 0
  const normalized: NormalizedBusiness[] = []
  for (const p of places) {
    const rating = p.rating ?? 0
    const needsDetails =
      rating > 0 &&
      rating < 3.5 &&
      reviewFetchCount < MAX_REVIEW_BUSINESSES
    const reviews = needsDetails && p.id ? await fetchPlaceReviews(p.id, apiKey) : []
    if (needsDetails && p.id) reviewFetchCount++
    normalized.push({
      name: p.displayName?.text ?? 'Sin nombre',
      rating,
      review_count: p.userRatingCount ?? 0,
      address: p.formattedAddress ?? '',
      types: p.types ?? [],
      price_level: priceLevelFromString(p.priceLevel),
      recent_reviews: reviews,
      phone: p.internationalPhoneNumber ?? null,
      website: p.websiteUri ?? null,
    })
  }

  const ratedRatings = normalized.filter((b) => b.rating > 0).map((b) => b.rating)

  return {
    businesses: normalized,
    avg_rating: calculateAvgRating(ratedRatings),
    rating_distribution: buildRatingDistribution(ratedRatings),
    total_count: normalized.length,
  }
}
