"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

export type PromotionalCarouselSlide = {
	id?: string;
	imageUrl: string;
	title?: string;
	description?: string;
	altText?: string;
	ctaLabel?: string;
	ctaHref?: string;
};

export type PromotionalContent = {
	title: string;
	description: string;
	dose: string;
	extractionTime: string;
	brewTemp: string;
	guestScore: string;
	carouselSlides?: PromotionalCarouselSlide[];
	carouselAutoplay?: boolean;
	carouselIntervalMs?: number;
};

interface PromoBannerProps {
	content?: PromotionalContent | null;
}

const SWIPE_THRESHOLD_PX = 46;

function isNonEmpty(value: string | null | undefined): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function isPermittedImageUrl(url: string): boolean {
	if (!isNonEmpty(url)) return false;

	const value = url.trim();
	return value.startsWith("/") || value.startsWith("http://") || value.startsWith("https://");
}

export function PromoBanner({ content }: PromoBannerProps) {
	const validSlides = useMemo(
		() =>
			(content?.carouselSlides ?? [])
				.filter((slide) => isPermittedImageUrl(slide.imageUrl))
				.map((slide) => ({
					...slide,
					imageUrl: slide.imageUrl.trim(),
					altText: isNonEmpty(slide.altText) ? slide.altText.trim() : undefined,
					title: isNonEmpty(slide.title) ? slide.title.trim() : undefined,
					description: isNonEmpty(slide.description) ? slide.description.trim() : undefined,
					ctaLabel: isNonEmpty(slide.ctaLabel) ? slide.ctaLabel.trim() : undefined,
					ctaHref: slide.ctaHref
				})),
		[content?.carouselSlides]
	);

	const [activeSlideIndex, setActiveSlideIndex] = useState(0);
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
	const touchStartXRef = useRef<number | null>(null);

	const hasCarousel = validSlides.length > 1;
	const hasSlides = validSlides.length > 0;

	useEffect(() => {
		if (!window.matchMedia) return;
		const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
		const updateMotionPreference = () => setPrefersReducedMotion(mediaQuery.matches);

		updateMotionPreference();

		if (typeof mediaQuery.addEventListener === "function") {
			mediaQuery.addEventListener("change", updateMotionPreference);
			return () => {
				mediaQuery.removeEventListener("change", updateMotionPreference);
			};
		}

		mediaQuery.addListener(updateMotionPreference);

		return () => {
			mediaQuery.removeListener(updateMotionPreference);
		};
	}, []);

	useEffect(() => {
		if (activeSlideIndex >= validSlides.length) {
			setActiveSlideIndex(0);
		}
	}, [activeSlideIndex, validSlides.length]);

	const rawIntervalMs = Number(content?.carouselIntervalMs);
	const intervalMs = Number.isFinite(rawIntervalMs)
		? Math.min(Math.max(rawIntervalMs, 2200), 15000)
		: 5500;
	const autoplayEnabled = hasCarousel && !prefersReducedMotion && content?.carouselAutoplay !== false;

	const goToSlide = useCallback(
		(index: number) => {
			if (!hasCarousel) return;
			const normalized = (index + validSlides.length) % validSlides.length;
			setActiveSlideIndex(normalized);
		},
		[hasCarousel, validSlides.length]
	);

	const advanceSlide = useCallback(
		(step: number) => {
			if (!hasCarousel) return;
			setActiveSlideIndex((currentIndex) => {
				const nextIndex = currentIndex + step;
				return (nextIndex + validSlides.length) % validSlides.length;
			});
		},
		[hasCarousel, validSlides.length]
	);

	useEffect(() => {
		if (!autoplayEnabled) return;

		const timer = window.setInterval(() => {
			advanceSlide(1);
		}, intervalMs);

		return () => window.clearInterval(timer);
	}, [advanceSlide, autoplayEnabled, intervalMs]);

	const getSlideState = (index: number): "is-active" | "is-next" | "is-prev" | "is-hidden" => {
		if (!hasCarousel) return index === activeSlideIndex ? "is-active" : "is-hidden";

		const delta = (index - activeSlideIndex + validSlides.length) % validSlides.length;
		if (delta === 0) return "is-active";
		if (delta === 1) return "is-next";
		if (delta === validSlides.length - 1) return "is-prev";
		return "is-hidden";
	};

	const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
		if (!hasCarousel) return;
		touchStartXRef.current = event.touches[0]?.clientX ?? null;
	};

	const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
		if (!hasCarousel || touchStartXRef.current === null) return;

		const touchEndX = event.changedTouches[0]?.clientX ?? touchStartXRef.current;
		const delta = touchEndX - touchStartXRef.current;
		touchStartXRef.current = null;

		if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
		if (delta < 0) {
			advanceSlide(1);
			return;
		}

		advanceSlide(-1);
	};

	if (!hasSlides) {
		return (
			<section
				className="promo-banner promo-banner--carousel"
				aria-label="Promotional banner"
			>
				<div className="promo-banner__viewport">
					<div className="promo-banner__slide" aria-hidden="true" />
				</div>
			</section>
		);
	}

	return (
		<section
			className="promo-banner promo-banner--carousel"
			aria-label="Promotional banner carousel"
		>
			<div
				className="promo-banner__viewport"
				onTouchStart={handleTouchStart}
				onTouchEnd={handleTouchEnd}
			>
				<div className="promo-banner__slides">
					{validSlides.map((slide, index) => {
						const slideAltText = slide.altText ?? slide.title ?? "Promotional image from Grit Coffee";
						const slideState = getSlideState(index);

						return (
							<div
								className={`promo-banner__slide ${slideState}`}
								key={slide.id ?? `${slide.imageUrl}-${index}`}
								aria-hidden={index !== activeSlideIndex}
							>
								<Image
									className="promo-banner__image"
									src={slide.imageUrl}
									alt={slideAltText}
									fill
									sizes="(max-width: 760px) 100vw, 38vw"
									unoptimized
								/>
							</div>
						);
					})}
				</div>
			</div>

			{hasCarousel ? (
				<>
					<div className="promo-banner__controls" aria-label="Promo slides navigation">
						<button
							type="button"
							className="promo-banner__control"
							onClick={() => advanceSlide(-1)}
							aria-label="Previous promo slide"
						>
							<span aria-hidden="true">&#8249;</span>
						</button>
						<button
							type="button"
							className="promo-banner__control"
							onClick={() => advanceSlide(1)}
							aria-label="Next promo slide"
						>
							<span aria-hidden="true">&#8250;</span>
						</button>
					</div>

					<div className="promo-banner__dots" role="tablist" aria-label="Choose promo slide">
						{validSlides.map((slide, index) => (
							<button
								type="button"
								key={`promo-dot-${slide.id ?? index}`}
								className={`promo-banner__dot ${index === activeSlideIndex ? "is-active" : ""}`}
								onClick={() => goToSlide(index)}
								role="tab"
								aria-selected={index === activeSlideIndex}
								aria-label={`Show slide ${index + 1} of ${validSlides.length}`}
							/>
						))}
					</div>
				</>
			) : null}

		</section>
	);
}