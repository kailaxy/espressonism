"use client";

import Link from "next/link";
import { MouseEvent, ReactNode, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { smoothScrollToElement } from "../lib/smoothScroll";
import { MobileMenuButton } from "./UI";

interface NavbarProps {
  cartCount: number;
  onCartClick: () => void;
  hrefPrefix?: string;
}

export function Navbar({ cartCount, onCartClick, hrefPrefix = "" }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleBrandClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    if (pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    router.push("/");
  };

  const handleNavToSection = (event: MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    event.preventDefault();

    if (pathname === "/") {
      const section = document.getElementById(sectionId);
      if (section) smoothScrollToElement(section);
      return;
    }

    sessionStorage.setItem("espressonism-scroll-target", sectionId);
    router.push("/");
  };

  const handleMenuLinkClick = (event: MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    handleNavToSection(event, sectionId);
    setIsMenuOpen(false);
  };

  return (
    <header className="topbar" aria-label="Main navigation">
      <a
        className="brand"
        href="/"
        aria-label="Espressonism home"
        onClick={handleBrandClick}
      >
        <svg className="brand-mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M5 8.5h11.5a2.5 2.5 0 0 1 0 5H15a5 5 0 0 1-10 0v-5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M4 16h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M8 6V4.2M11 6V3.7M14 6V4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        ESPRESSONISM
      </a>

      <MobileMenuButton isOpen={isMenuOpen} onToggle={() => setIsMenuOpen((open) => !open)} />

      <nav id="menu-links" aria-label="Section links" className="menu" data-open={isMenuOpen}>
        <a href={`${hrefPrefix}#method`} onClick={(event) => handleMenuLinkClick(event, "method")}>Method</a>
        <a href={`${hrefPrefix}#gallery`} onClick={(event) => handleMenuLinkClick(event, "gallery")}>Gallery</a>
        <a href={`${hrefPrefix}#testimonials`} onClick={(event) => handleMenuLinkClick(event, "testimonials")}>Stories</a>
        <Link href="/loyalty" onClick={() => setIsMenuOpen(false)}>Loyalty</Link>
        <a href={`${hrefPrefix}#visit`} onClick={(event) => handleMenuLinkClick(event, "visit")}>Visit</a>
      </nav>

      <div className="topbar-actions">
        <a href="/order" className="cta">
          Start Ordering
        </a>
      </div>
    </header>
  );
}

interface SectionProps {
  id?: string;
  title?: string;
  description?: string;
  children: ReactNode;
  reveal?: boolean;
}

export function Section({ id, title, description, children, reveal = true }: SectionProps) {
  const className = reveal ? "section reveal-on-scroll" : "section";
  return (
    <section id={id} className={className}>
      {title && <h2>{title}</h2>}
      {description && <p>{description}</p>}
      {children}
    </section>
  );
}

interface Button {
  label: string;
  variant?: "primary" | "ghost";
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}

interface HeroProps {
  title: string;
  subtitle: string;
  description: string;
  actions: Button[];
  cardContent: ReactNode;
}

export function Hero({ title, subtitle, description, actions, cardContent }: HeroProps) {
  return (
    <main className="hero">
      <section>
        <span className="hero-kicker intro intro-1">{subtitle}</span>
        <h1 className="hero-title intro intro-2">{title}</h1>
        <p className="hero-copy intro intro-3">{description}</p>
        <div className="hero-actions intro intro-3">
          {actions.map((action) => (
            <button
              key={action.label}
              className={action.variant === "ghost" ? "btn-ghost" : "cta"}
              type={action.type || "button"}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>

      <aside className="hero-card intro intro-2" aria-label="Today highlights">
        {cardContent}
      </aside>
    </main>
  );
}
