"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { smoothScrollToElement } from "./lib/smoothScroll";
import orderCtaImage from "../asset/asset1.png";
// @ts-ignore - Supabase client is intentionally authored in a JavaScript module.
import { supabase } from "../supabaseClient";
import {
  Navbar,
  Hero,
  Section,
  LoyaltyCard,
  FeatureGrid,
  VisitSection
} from "./components";

type TodayAtBarRow = {
  title: string | null;
  description: string | null;
  dose: string | null;
  extraction_time: string | null;
  brew_temp: string | null;
  guest_score: string | number | null;
};

type TodayAtBarCard = {
  title: string;
  description: string;
  dose: string;
  extractionTime: string;
  brewTemp: string;
  guestScore: string;
};

const DEFAULT_TODAY_AT_BAR: TodayAtBarCard = {
  title: "Today at the Bar",
  description: "Single-origin Ethiopia on slow pour, plus our house espresso blend with cacao and citrus finish.",
  dose: "18g",
  extractionTime: "27s",
  brewTemp: "92C",
  guestScore: "4.9/5"
};

function mapTodayAtBarRowToCard(row: TodayAtBarRow | null | undefined): TodayAtBarCard {
  return {
    title: row?.title?.trim() || DEFAULT_TODAY_AT_BAR.title,
    description: row?.description?.trim() || DEFAULT_TODAY_AT_BAR.description,
    dose: row?.dose?.trim() || DEFAULT_TODAY_AT_BAR.dose,
    extractionTime: row?.extraction_time?.trim() || DEFAULT_TODAY_AT_BAR.extractionTime,
    brewTemp: row?.brew_temp?.trim() || DEFAULT_TODAY_AT_BAR.brewTemp,
    guestScore:
      row?.guest_score === null || row?.guest_score === undefined || String(row.guest_score).trim() === ""
        ? DEFAULT_TODAY_AT_BAR.guestScore
        : String(row.guest_score).trim()
  };
}

const loyaltyProgram = {
  title: "Coffee Passport",
  description: "Your barista stamps every handcrafted cup.",
  rule: "Buy 5 coffees, get 1 free",
  punchesRequired: 5,
  rewardLabel: "Free coffee applies to any regular espresso-based drink.",
  notes: [
    "Any espresso-based coffee earns one stamp",
    "On your 6th visit, your drink is on the house",
    "Use physical card or app profile at checkout",
    "Stamp progress never expires"
  ]
};

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
  const [todayAtBar, setTodayAtBar] = useState<TodayAtBarCard>(DEFAULT_TODAY_AT_BAR);

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

    const fetchTodayAtBar = async () => {
      const { data, error } = await supabase
        .from("today_at_bar")
        .select("title, description, dose, extraction_time, brew_temp, guest_score")
        .eq("id", 1)
        .maybeSingle();

      if (!isMounted) return;
      if (!error && data) {
        setTodayAtBar(mapTodayAtBarRowToCard(data as TodayAtBarRow));
      }
    };

    void fetchTodayAtBar();

    return () => {
      isMounted = false;
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
    <div className="shell">
      <Navbar cartCount={0} onCartClick={() => {}} />

      <Hero
        title="Brew Loud."
        subtitle="Small Batch | City Roasted"
        description="Espressonism turns coffee into a daily ceremony. Precision extraction, expressive flavor notes, and a space designed for people who love bold craft."
        actions={[
          { label: "Explore Signature Drinks", variant: "primary", onClick: handleExploreSignature },
          { label: "Learn About Beans", variant: "ghost", onClick: handleExploreBeans }
        ]}
        cardContent={
          <>
            <h2 style={{ marginTop: 0 }}>{todayAtBar.title}</h2>
            <p>{todayAtBar.description}</p>
            <div className="stat-grid">
              <div className="stat">
                <span className="stat-value">{todayAtBar.dose}</span>
                Dose Per Shot
              </div>
              <div className="stat">
                <span className="stat-value">{todayAtBar.extractionTime}</span>
                Extraction Time
              </div>
              <div className="stat">
                <span className="stat-value">{todayAtBar.brewTemp}</span>
                Brew Temp
              </div>
              <div className="stat">
                <span className="stat-value">{todayAtBar.guestScore}</span>
                Guest Score
              </div>
            </div>
          </>
        }
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
        <FeatureGrid features={features} />
      </Section>

      <Section
        id="signature"
        title="Signature Drinks"
        description="Handcrafted espresso compositions exploring taste, texture, and technique. Each drink tells a story of our roast profile."
      >
        <div className="signature-grid">
          <article className="signature-card">
            <h3>Spanish Latte</h3>
            <p className="signature-price">PHP 145 • Best Seller</p>
            <p className="signature-description">Silky espresso with condensed milk sweetness. A traditional preparation with our modern roast.</p>
          </article>
          <article className="signature-card">
            <h3>Sea Salt Mocha</h3>
            <p className="signature-price">PHP 160</p>
            <p className="signature-description">Chocolate espresso with a sea-salt cream top. Balances richness with subtle minerality.</p>
          </article>
          <article className="signature-card">
            <h3>Orange Cold Brew</h3>
            <p className="signature-price">PHP 165 • Seasonal</p>
            <p className="signature-description">Citrus-bright cold brew over crystal ice. Refreshing complexity with fruity notes.</p>
          </article>
          <article className="signature-card">
            <h3>Burnt Bascoff Latte</h3>
            <p className="signature-price">PHP 170</p>
            <p className="signature-description">Caramelized cookie butter and espresso fusion. Dessert-forward but balanced.</p>
          </article>
        </div>
      </Section>

      <Section id="gallery" title="Gallery" description="Fresh drops from Espressonism straight from Instagram.">
        <div className="gallery-widget-shell">
          <div className="gallery-widget-frame">
            <div className="elfsight-app-3624b87b-3304-40b7-8e09-8976e1cb7e2c" data-elfsight-app-lazy />
          </div>
        </div>
      </Section>

      <Section id="testimonials" title="Guest Stories" description="People who love flavor clarity, atmosphere, and obsessive craft.">
        <div className="review-widget-shell">
          <div className="review-widget-head">
            <p className="review-widget-kicker">What Guests Say</p>
          </div>
          <div className="review-widget-frame">
            <div className="elfsight-app-63d5cbb8-6257-4ed0-bbd3-e4492e650627" data-elfsight-app-lazy />
          </div>
        </div>
        <Script src="https://elfsightcdn.com/platform.js" strategy="afterInteractive" />
      </Section>

      <Section id="loyalty" title="Loyalty Program" description="Every coffee brings you closer to a free one."><LoyaltyCard program={loyaltyProgram} /></Section>

      <Section id="visit" reveal={false}>
        <VisitSection
          title="VISIT US!"
          description="OPEN AT 4 PM to 12 MN, Monday-Friday @ 557 San Joaquin St., Brgy. Plainview, Mandaluyong City."
          buttonLabel="Open in Google Maps"
          mapContent={
            <iframe
              title="Espressonism Mandaluyong map"
              src="https://www.google.com/maps?q=14.5809759,121.0313082&z=17&output=embed"
              loading="lazy"
            />
          }
        />
      </Section>
    </div>
  );
}
