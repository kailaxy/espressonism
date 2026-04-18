"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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

const DEFAULT_PROMOTIONAL_TITLE = "Featured: The Espressonism Signature";
const DEFAULT_PROMOTIONAL_CTA_LABEL = "Order Now";
const DEFAULT_PROMOTIONAL_CTA_HREF = "/order";
const SWIPE_THRESHOLD_PX = 46;

function isNonEmpty(value: string | null | undefined): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function isPermittedImageUrl(url: string): boolean {
	if (!isNonEmpty(url)) return false;

	const value = url.trim();
	return value.startsWith("/") || value.startsWith("http://") || value.startsWith("https://");
}

function sanitizeHref(href: string | undefined): string {
	if (!isNonEmpty(href)) return DEFAULT_PROMOTIONAL_CTA_HREF;
	const value = href.trim();
	if (value.startsWith("/") || value.startsWith("http://") || value.startsWith("https://")) return value;
	return DEFAULT_PROMOTIONAL_CTA_HREF;
}

function isExternalHref(href: string): boolean {
	return href.startsWith("http://") || href.startsWith("https://");
}

function BannerCta({ href, label }: { href: string; label: string }) {
	if (isExternalHref(href)) {
		return (
			<a href={href} className="promo-banner__button" target="_blank" rel="noreferrer noopener">
				{label}
			</a>
		);
	}

	return (
		<Link href={href} className="promo-banner__button">
			{label}
		</Link>
	);
}

export function PromoBanner({ content }: PromoBannerProps) {
	const promoTitle = isNonEmpty(content?.title) ? content.title.trim() : DEFAULT_PROMOTIONAL_TITLE;
	const hasSupplementaryLine = isNonEmpty(content?.description);
	const supplementaryLine = hasSupplementaryLine
		? content?.description.trim()
		: [content?.dose, content?.extractionTime, content?.brewTemp, content?.guestScore]
				.filter(isNonEmpty)
				.map((value) => value.trim())
				.join(" • ");

	const validSlides = useMemo(
		() =>
			(content?.carouselSlides ?? [])
				.filter((slide) => isPermittedImageUrl(slide.imageUrl))
				.map((slide) => ({
					...slide,
					imageUrl: slide.imageUrl.trim(),
					title: isNonEmpty(slide.title) ? slide.title.trim() : undefined,
					description: isNonEmpty(slide.description) ? slide.description.trim() : undefined,
					altText: isNonEmpty(slide.altText) ? slide.altText.trim() : undefined,
					ctaLabel: isNonEmpty(slide.ctaLabel) ? slide.ctaLabel.trim() : undefined,
					ctaHref: sanitizeHref(slide.ctaHref)
				})),
		[content?.carouselSlides]
	);

	const [activeSlideIndex, setActiveSlideIndex] = useState(0);
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(true);
	const touchStartXRef = useRef<number | null>(null);

	const hasCarousel = validSlides.length > 1;
	const hasSlides = validSlides.length > 0;

	useEffect(() => {
		if (!window.matchMedia) return;
		const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
		const updateMotionPreference = () => setPrefersReducedMotion(mediaQuery.matches);

		updateMotionPreference();
		mediaQuery.addEventListener("change", updateMotionPreference);

		return () => {
			mediaQuery.removeEventListener("change", updateMotionPreference);
		};
	}, []);

	useEffect(() => {
		if (activeSlideIndex >= validSlides.length) {
			setActiveSlideIndex(0);
		}
	}, [activeSlideIndex, validSlides.length]);

	const intervalMs = Math.min(Math.max(content?.carouselIntervalMs ?? 5500, 2200), 15000);
	const autoplayEnabled = hasCarousel && !prefersReducedMotion && content?.carouselAutoplay !== false;

	useEffect(() => {
		if (!autoplayEnabled) return;

		const timer = window.setInterval(() => {
			setActiveSlideIndex((currentIndex) => (currentIndex + 1) % validSlides.length);
		}, intervalMs);

		return () => window.clearInterval(timer);
	}, [autoplayEnabled, intervalMs, validSlides.length]);

	const goToSlide = (index: number) => {
		if (!hasCarousel) return;
		const normalized = (index + validSlides.length) % validSlides.length;
		setActiveSlideIndex(normalized);
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
			goToSlide(activeSlideIndex + 1);
			return;
		}

		goToSlide(activeSlideIndex - 1);
	};

	if (!hasSlides) {
		return (
			<section className="promo-banner" aria-labelledby="promo-banner-heading">
				<div className="promo-banner__content">
					<h2 id="promo-banner-heading" className="promo-banner__title">
						{promoTitle}
					</h2>
					{isNonEmpty(supplementaryLine) ? <p className="promo-banner__meta">{supplementaryLine}</p> : null}
					<BannerCta href={DEFAULT_PROMOTIONAL_CTA_HREF} label={DEFAULT_PROMOTIONAL_CTA_LABEL} />
				</div>
			</section>
		);
	}

	const activeSlide = validSlides[activeSlideIndex] ?? validSlides[0];
	const activeTitle = activeSlide.title ?? promoTitle;
	const activeMeta = activeSlide.description ?? supplementaryLine;
	const activeCtaLabel = activeSlide.ctaLabel ?? DEFAULT_PROMOTIONAL_CTA_LABEL;
	const activeCtaHref = activeSlide.ctaHref ?? DEFAULT_PROMOTIONAL_CTA_HREF;
	return (
		<section className="promo-banner promo-banner--carousel" aria-labelledby="promo-banner-heading">
			<div
				className="promo-banner__slides"
				style={{ transform: `translateX(-${activeSlideIndex * 100}%)` }}
				onTouchStart={handleTouchStart}
				onTouchEnd={handleTouchEnd}
			>
				{validSlides.map((slide, index) => {
					const slideAltText =
						slide.altText ?? slide.title ?? promoTitle ?? "Featured drink from Espressonism";

					return (
						<div
							className="promo-banner__slide"
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

			<div className="promo-banner__overlay" />

			<div className="promo-banner__content promo-banner__content--carousel">
				<h2 id="promo-banner-heading" className="promo-banner__title">
					{activeTitle}
				</h2>
				{isNonEmpty(activeMeta) ? <p className="promo-banner__meta">{activeMeta}</p> : null}
				<BannerCta href={activeCtaHref} label={activeCtaLabel} />
			</div>

			{hasCarousel ? (
				<>
					<div className="promo-banner__controls" aria-label="Promo slides navigation">
						<button
							type="button"
							className="promo-banner__control"
							onClick={() => goToSlide(activeSlideIndex - 1)}
							aria-label="Previous promo slide"
						>
							<span aria-hidden="true">&#8249;</span>
						</button>
						<button
							type="button"
							className="promo-banner__control"
							onClick={() => goToSlide(activeSlideIndex + 1)}
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