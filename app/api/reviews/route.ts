type GoogleReview = {
  author_name?: string
  profile_photo_url?: string
  rating?: number
  relative_time_description?: string
  text?: string
  time?: number
}

type GooglePlaceDetailsResult = {
  rating?: number
  user_ratings_total?: number
  reviews?: GoogleReview[]
}

type GooglePlaceDetailsResponse = {
  result?: GooglePlaceDetailsResult
  status?: string
  error_message?: string
}

const CACHE_CONTROL_VALUE = 's-maxage=86400, stale-while-revalidate'

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': CACHE_CONTROL_VALUE,
    },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export async function GET(): Promise<Response> {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    const placeId = process.env.NEXT_PUBLIC_GOOGLE_PLACE_ID

    if (!apiKey || !placeId) {
      throw new Error('Missing required environment variables for Google Places API')
    }

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,reviews&key=${apiKey}`
    const upstream = await fetch(url)

    if (!upstream.ok) {
      throw new Error(`Google Places request failed with status ${upstream.status}`)
    }

    const payload: unknown = await upstream.json()

    if (!isRecord(payload)) {
      throw new Error('Google Places response payload is invalid')
    }

    const data = payload as GooglePlaceDetailsResponse

    if (!data.result || !isRecord(data.result)) {
      throw new Error(data.error_message || 'Google Places response missing result')
    }

    const result = data.result
    const reviews = Array.isArray(result.reviews) ? result.reviews : []
    const filteredReviews = reviews.filter((review) => {
      const rating = typeof review?.rating === 'number' ? review.rating : 0
      return rating >= 4
    })

    return jsonResponse({
      overallRating: typeof result.rating === 'number' ? result.rating : null,
      totalRatings:
        typeof result.user_ratings_total === 'number' ? result.user_ratings_total : null,
      reviews: filteredReviews,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch reviews'
    return jsonResponse(
      {
        error: message,
      },
      500,
    )
  }
}