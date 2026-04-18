"use client";

import { useEffect, useMemo, useState } from "react";
import { Skeleton, SkeletonGroup } from "./UI";

type GoogleReview = {
  author_name?: string;
  profile_photo_url?: string;
  rating?: number;
  text?: string;
};

type ReviewsApiResponse = {
  reviews?: GoogleReview[];
  error?: string;
};

const FALLBACK_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='48' fill='%23f4e3c0'/%3E%3Ccircle cx='48' cy='36' r='16' fill='%23a35d2a'/%3E%3Crect x='24' y='58' width='48' height='22' rx='11' fill='%23a35d2a'/%3E%3C/svg%3E";

const BROKEN_IMAGE_AVATAR =
  "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";

function getSafeRating(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.min(5, Math.max(0, Math.round(value)));
}

function renderStars(rating: number): string {
  const filled = "⭐".repeat(rating);
  const empty = "☆".repeat(5 - rating);
  return `${filled}${empty}`;
}

export function GoogleReviews() {
  const [reviews, setReviews] = useState<GoogleReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadReviews = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/reviews", {
          signal: controller.signal,
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error(`Request failed (${response.status})`);
        }

        const payload: ReviewsApiResponse = await response.json();
        const safeReviews = Array.isArray(payload.reviews) ? payload.reviews : [];
        setReviews(safeReviews);
        setError(payload.error || null);
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        const message = fetchError instanceof Error ? fetchError.message : "Failed to load reviews";
        setError(message);
        setReviews([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void loadReviews();

    return () => controller.abort();
  }, []);

  const hasReviews = useMemo(() => reviews.length > 0, [reviews]);

  if (isLoading) {
    return (
      <div className="google-reviews" aria-live="polite" aria-busy="true">
        <div className="google-reviews-list" role="list">
          {Array.from({ length: 3 }).map((_, index) => (
            <article className="google-review-card" role="listitem" key={`loading-skeleton-${index}`}>
              <SkeletonGroup>
                <header className="google-review-head">
                  <Skeleton type="block" className="google-review-avatar" width={40} height={40} />
                  <div style={{ width: "100%" }}>
                    <Skeleton width="50%" />
                    <Skeleton width="35%" />
                  </div>
                </header>
                <Skeleton width="100%" />
                <Skeleton width="85%" />
                <Skeleton width="65%" />
              </SkeletonGroup>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (!hasReviews) {
    return (
      <div className="google-reviews" aria-live="polite">
        <p className="google-reviews-status">
          {error ? "Reviews are temporarily unavailable. Please check back soon." : "No guest reviews yet. Be the first to share your experience."}
        </p>
      </div>
    );
  }

  return (
    <div className="google-reviews" aria-label="Google guest reviews">
      <div className="google-reviews-list" role="list">
        {reviews.map((review, index) => {
          const authorName = review.author_name?.trim() || "Anonymous Guest";
          const rating = getSafeRating(review.rating);
          const reviewText = review.text?.trim() || "No written feedback was provided.";
          const profilePhoto = review.profile_photo_url?.trim() || FALLBACK_AVATAR;

          return (
            <article className="google-review-card" role="listitem" key={`${authorName}-${index}`}>
              <header className="google-review-head">
                <img
                  className="google-review-avatar"
                  src={profilePhoto}
                  alt={`${authorName} profile photo`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = BROKEN_IMAGE_AVATAR;
                  }}
                  width={40}
                  height={40}
                />
                <div>
                  <p className="google-review-author">{authorName}</p>
                  <p className="google-review-stars" aria-label={`${rating} out of 5 stars`}>
                    {renderStars(rating)}
                  </p>
                </div>
              </header>
              <p className="google-review-text">{reviewText}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}