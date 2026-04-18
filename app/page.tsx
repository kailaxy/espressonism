"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { smoothScrollToElement } from "./lib/smoothScroll";
import orderCtaImage from "../asset/asset1.png";
// @ts-ignore - Supabase client is intentionally authored in a JavaScript module.
import { supabase } from "../supabaseClient";
import {
  Navbar,
  Hero,
  Section,
  FeatureGrid,
  VisitSection,
  PromoBanner,
  ReviewsWrapper,
  Skeleton,
  SkeletonGroup
} from "./components";
import type { PromotionalCarouselSlide, PromotionalContent } from "./components/PromoBanner";

type MenuItemRow = {
  id: string;
  name: string | null;
  description: string | null;
  base_price: string | number | null;
  category: string | null;
  image_url: string | null;
};

type PromotionalRow = {
  id: number;
  title: string | null;
  description: string | null;
  dose: string | null;
  extraction_time: string | null;
  brew_temp: string | null;
  guest_score: string | null;
  carousel_enabled: boolean | null;
  carousel_autoplay: boolean | null;
  carousel_interval_ms: number | null;
  carousel_slides: unknown;
};

type PromotionalSlideRow = {
  id?: unknown;
  image_url?: unknown;
  title?: unknown;
  description?: unknown;
  alt_text?: unknown;
  cta_label?: unknown;
  cta_href?: unknown;
};

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parsePromotionalSlides(value: unknown): PromotionalCarouselSlide[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): PromotionalCarouselSlide | null => {
      const row = (item ?? {}) as PromotionalSlideRow;
      const imageUrl = nonEmptyString(row.image_url);
      if (!imageUrl) return null;

      return {
        id: nonEmptyString(row.id) ?? undefined,
        imageUrl,
        title: nonEmptyString(row.title) ?? undefined,
        description: nonEmptyString(row.description) ?? undefined,
        altText: nonEmptyString(row.alt_text) ?? undefined,
        ctaLabel: nonEmptyString(row.cta_label) ?? undefined,
        ctaHref: nonEmptyString(row.cta_href) ?? undefined
      };
    })
    .filter((slide): slide is PromotionalCarouselSlide => slide !== null);
}

function formatSignaturePrice(price: string | number | null | undefined): string {
  const numericPrice = typeof price === "string" ? Number(price) : price;
  if (typeof numericPrice === "number" && Number.isFinite(numericPrice)) {
    const formatted = numericPrice % 1 === 0 ? numericPrice.toFixed(0) : numericPrice.toFixed(2);
    return `PHP ${formatted}`;
  }

  return "PHP --";
}

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 5h10l2 4-7 10L5 9l2-4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
    title: "Direct Micro Lots",
    description: "Transparent partnerships with producers we know by name."
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 4v16M6 8l6-4 6 4M6 16l6 4 6-4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: "Profiled Roasting",
    description: "Curve-driven roast development tuned for sweetness and clarity."
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 13h8l2-3 2 6 2-3h2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: "Precision Brewing",
    description: "Daily calibration for grind, dose, and flow to keep every cup consistent."
  }
];

export default function Home() {
  const router = useRouter();
  const [signatureItems, setSignatureItems] = useState<MenuItemRow[]>([]);
  const [promotionalContent, setPromotionalContent] = useState<PromotionalContent | null>(null);
  const [isSignatureLoading, setIsSignatureLoading] = useState(true);
  const [isGalleryWidgetLoading, setIsGalleryWidgetLoading] = useState(true);

  useEffect(() => {
    const items = document.querySelectorAll<HTMLElement>(".reveal-on-scroll");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const pendingSection = sessionStorage.getItem("espressonism-scroll-target");
    if (!pendingSection) return;

    sessionStorage.removeItem("espressonism-scroll-target");
    window.setTimeout(() => {
      const section = document.getElementById(pendingSection);
      if (section) smoothScrollToElement(section);
    }, 80);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchSignatureItems = async () => {
      setIsSignatureLoading(true);

      const { data, error } = await supabase
        .from("menu_items")
        .select("id, name, description, base_price, category, image_url")
        .eq("category", "signature")
        .order("base_price", { ascending: true })
        .order("name", { ascending: true });

      if (!isMounted) return;

      if (error || !data) {
        setSignatureItems([]);
        setIsSignatureLoading(false);
        return;
      }

      const onlySignatureItems = (data as MenuItemRow[]).filter((item) => item.category === "signature");
      setSignatureItems(onlySignatureItems);
      setIsSignatureLoading(false);
    };

    void fetchSignatureItems();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchPromotionalContent = async () => {
      const { data, error } = await supabase
        .from("today_at_bar")
        .select(
          "id, title, description, dose, extraction_time, brew_temp, guest_score, carousel_enabled, carousel_autoplay, carousel_interval_ms, carousel_slides"
        )
        .eq("id", 1)
        .maybeSingle();

      if (!isMounted || error || !data) {
        setPromotionalContent(null);
        return;
      }

      const promotionalRow = data as PromotionalRow;
      const parsedSlides = parsePromotionalSlides(promotionalRow.carousel_slides);
      const hasCarouselEnabled = promotionalRow.carousel_enabled !== false;

      setPromotionalContent({
        title: promotionalRow.title ?? "",
        description: promotionalRow.description ?? "",
        dose: promotionalRow.dose ?? "",
        extractionTime: promotionalRow.extraction_time ?? "",
        brewTemp: promotionalRow.brew_temp ?? "",
        guestScore: promotionalRow.guest_score ?? "",
        carouselSlides: hasCarouselEnabled ? parsedSlides : [],
        carouselAutoplay: promotionalRow.carousel_autoplay ?? undefined,
        carouselIntervalMs:
          typeof promotionalRow.carousel_interval_ms === "number" && Number.isFinite(promotionalRow.carousel_interval_ms)
            ? promotionalRow.carousel_interval_ms
            : undefined
      });
    };

    void fetchPromotionalContent();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const markLoadedIfWidgetReady = () => {
      const widgetRoot = document.querySelector(".gallery-widget-frame [class^='elfsight-app-']");
      if (!widgetRoot) return false;

      const hasRenderedWidgetContent = widgetRoot.childElementCount > 0;
      if (hasRenderedWidgetContent && isMounted) {
        setIsGalleryWidgetLoading(false);
      }

      return hasRenderedWidgetContent;
    };

    if (markLoadedIfWidgetReady()) {
      return () => {
        isMounted = false;
      };
    }

    const pollId = window.setInterval(() => {
      markLoadedIfWidgetReady();
    }, 350);

    const timeoutId = window.setTimeout(() => {
      if (isMounted) setIsGalleryWidgetLoading(false);
      window.clearInterval(pollId);
    }, 2400);

    return () => {
      isMounted = false;
      window.clearInterval(pollId);
      window.clearTimeout(timeoutId);
    };
  }, []);

  const handleExploreSignature = () => {
    const section = document.getElementById("signature");
    if (section) smoothScrollToElement(section);
  };

  const handleExploreBeans = () => {
    router.push("/beans");
  };

  return (
    <div className="shell home-shell">
      <Navbar cartCount={0} onCartClick={() => {}} />

      <Hero
        title="Brew Loud."
        subtitle="Small Batch | City Roasted"
        description="Espressonism turns coffee into a daily ceremony. Precision extraction, expressive flavor notes, and a space designed for people who love bold craft."
        cardClassName="hero-card--promo"
        actions={[
          { label: "Explore Signature Drinks", variant: "primary", onClick: handleExploreSignature },
          { label: "Learn About Beans", variant: "ghost", onClick: handleExploreBeans }
        ]}
        cardContent={<PromoBanner content={promotionalContent} />}
      />

      <Section id="order-cta" reveal={false}>
        <div className="order-cta-section order-cta-section-top">
          <Image
            src={orderCtaImage}
            alt=""
            aria-hidden
            className="order-cta-bg-image"
            fill
            sizes="(max-width: 760px) 100vw, (max-width: 1280px) 92vw, 1200px"
          />
          <div className="order-cta-content">
            <h2>Order Now</h2>
            <p>Skip the wait. Order your coffee ahead and pick it up fresh.</p>
            <Link href="/order" className="order-nav-link">
              <button className="cta cta-large" type="button">
                Start Ordering
              </button>
            </Link>
          </div>
        </div>
      </Section>

      <Section
        id="method"
        title="Minimal Ritual. Maximum Flavor."
        description="Every cup follows one principle: remove noise, amplify character. We source directly, roast weekly, and calibrate by taste every morning."
      >
        <div
          className="home-horizontal-region method-horizontal-region"
          role="region"
          aria-label="Method highlights. On mobile, swipe horizontally to browse cards."
        >
          <FeatureGrid features={features} />
        </div>
      </Section>

      <Section
        id="signature"
        title="Signature Drinks"
        description="Handcrafted espresso compositions exploring taste, texture, and technique. Each drink tells a story of our roast profile."
      >
        <div
          className="signature-grid home-horizontal-region signature-horizontal-region"
          role="region"
          aria-label="Signature drinks. On mobile, swipe horizontally to browse cards."
        >
          {isSignatureLoading ? (
            Array.from({ length: 2 }).map((_, index) => (
              <article className="signature-card" key={`signature-skeleton-${index}`}>
                <SkeletonGroup>
                  <Skeleton type="block" width="100%" height="8.2rem" />
                  <Skeleton type="text" width="58%" height="1.4rem" />
                  <Skeleton type="text" width="34%" height="1rem" />
                  <Skeleton type="text" width="94%" height="0.95rem" />
                  <Skeleton type="text" width="78%" height="0.95rem" />
                </SkeletonGroup>
              </article>
            ))
          ) : signatureItems.length === 0 ? (
            <article className="signature-card">
              <h3>No signature drinks available</h3>
              <p className="signature-price">Please check back soon</p>
              <p className="signature-description">Our signature menu is being updated right now.</p>
            </article>
          ) : (
            signatureItems.map((item) => (
              <article className="signature-card" key={item.id}>
                <div className="signature-media">
                  {item.image_url ? (
                    <Image
                      src={item.image_url}
                      alt={item.name?.trim() ? `${item.name.trim()} signature drink` : "Signature drink"}
                      fill
                      sizes="(max-width: 760px) 100vw, (max-width: 1200px) 46vw, 520px"
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "grid",
                        placeItems: "center",
                        color: "#7a472a",
                        fontWeight: 700,
                        fontSize: "0.86rem",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase"
                      }}
                    >
                      Image Coming Soon
                    </div>
                  )}
                </div>
                <h3>{item.name?.trim() || "Signature Drink"}</h3>
                <p className="signature-price">{formatSignaturePrice(item.base_price)}</p>
                <p className="signature-description">
                  {item.description?.trim() || "Handcrafted by our baristas with our current roast profile."}
                </p>
              </article>
            ))
          )}
        </div>
      </Section>

      <Section id="gallery" title="Gallery" description="Fresh drops from Espressonism straight from Instagram.">
        <div className="gallery-widget-shell">
          <div
            className="gallery-widget-frame home-horizontal-region gallery-horizontal-region"
            role="region"
            aria-label="Gallery feed. On mobile, swipe horizontally to browse."
            tabIndex={0}
          >
            {isGalleryWidgetLoading ? (
              <div style={{ padding: "1rem" }}>
                <SkeletonGroup>
                  <Skeleton type="text" width="44%" height="1.15rem" />
                  <Skeleton type="text" width="92%" height="0.95rem" />
                  <Skeleton type="block" width="100%" height="9.5rem" />
                  <Skeleton type="block" width="100%" height="9.5rem" />
                </SkeletonGroup>
              </div>
            ) : null}
            <div className="elfsight-app-3624b87b-3304-40b7-8e09-8976e1cb7e2c" data-elfsight-app-lazy />
          </div>
        </div>
      </Section>

      <Section id="testimonials" title="Guest Stories" description="People who love flavor clarity, atmosphere, and obsessive craft.">
        <div
          className="home-horizontal-region testimonials-horizontal-region"
          role="region"
          aria-label="Guest stories. On mobile, swipe horizontally to browse reviews."
        >
          <ReviewsWrapper />
        </div>
      </Section>

      <Section id="visit" reveal={false}>
        <VisitSection
          title="VISIT US!"
          description="OPEN AT 4 PM to 12 MN, Monday-Friday @ 557 San Joaquin St., Brgy. Plainview, Mandaluyong City."
          buttonLabel="Open in Google Maps"
        />
      </Section>
    </div>
  );
}
