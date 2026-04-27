"use client";

import Image from "next/image";
import Link from "next/link";
import { MouseEvent, ReactNode, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { smoothScrollToElement } from "../lib/smoothScroll";
import { MobileMenuButton } from "./UI";
import gritLogoHorizontal from "../../asset/logo/GRIT COFFEE LOGO Horizontal kyoto dusk.png";
import gritLogoBull from "../../asset/logo/GRIT COFFEE LOGO_no_text_kyoto_dusk.png";

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
        aria-label="Grit Coffee home"
        onClick={handleBrandClick}
      >
        <Image
          className="brand-logo brand-logo--full"
          src={gritLogoHorizontal}
          alt="Grit Coffee logo"
          priority
          sizes="(max-width: 980px) 0px, 230px"
        />
        <Image
          className="brand-logo brand-logo--icon"
          src={gritLogoBull}
          alt="Grit Coffee bull icon logo"
          priority
          sizes="(max-width: 980px) 44px, 0px"
        />
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
  cardClassName?: string;
}

export function Hero({ title, subtitle, description, actions, cardContent, cardClassName }: HeroProps) {
  const resolvedCardClassName = cardClassName ? `hero-card ${cardClassName}` : "hero-card";

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

      <aside className={`${resolvedCardClassName} intro intro-2`} aria-label="Highlights">
        {cardContent}
      </aside>
    </main>
  );
}
