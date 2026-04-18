"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { GoogleReviews } from "./GoogleReviews";
import { Skeleton, SkeletonGroup } from "./UI";

const ELFSIGHT_APP_CLASS = "elfsight-app-63d5cbb8-6257-4ed0-bbd3-e4492e650627";
const FALLBACK_CHECK_DELAY_MS = 3500;

export function ReviewsWrapper() {
  const [useFallback, setUseFallback] = useState(false);
  const [isResolvingSource, setIsResolvingSource] = useState(true);
  const widgetContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (useFallback) {
      setIsResolvingSource(false);
      return;
    }

    setIsResolvingSource(true);

    const timeoutId = window.setTimeout(() => {
      const container = widgetContainerRef.current;
      if (!container) {
        setUseFallback(true);
        setIsResolvingSource(false);
        return;
      }

      const elfsightNode = container.querySelector(`.${ELFSIGHT_APP_CLASS}`) as HTMLElement | null;
      const widgetNode = elfsightNode ?? container;
      const widgetText = (widgetNode.textContent || "").toLowerCase();

      const hasZeroHeight = widgetNode.getBoundingClientRect().height === 0;
      const hasNoChildNodes = widgetNode.childNodes.length === 0;
      const hasErrorOrLimitText = widgetText.includes("error") || widgetText.includes("limit");

      if (hasZeroHeight || hasNoChildNodes || hasErrorOrLimitText) {
        setUseFallback(true);
      } else {
        setIsResolvingSource(false);
      }
    }, FALLBACK_CHECK_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [useFallback]);

  if (useFallback) {
    return <GoogleReviews />;
  }

  return (
    <>
      {isResolvingSource && (
        <div className="google-reviews" aria-live="polite" aria-busy="true">
          <div className="google-reviews-list" role="list">
            {Array.from({ length: 3 }).map((_, index) => (
              <article className="google-review-card" role="listitem" key={`wrapper-skeleton-${index}`}>
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
      )}

      <div
        ref={widgetContainerRef}
        style={{ maxHeight: "640px", overflowY: "auto", display: isResolvingSource ? "none" : "block" }}
      >
        <div className={ELFSIGHT_APP_CLASS} data-elfsight-app-lazy />
      </div>
      <Script src="https://elfsightcdn.com/platform.js" strategy="afterInteractive" />
    </>
  );
}
