import { ReactNode } from "react";

interface MenuButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function MobileMenuButton({ isOpen, onToggle }: Omit<MenuButtonProps, "children">) {
  return (
    <button
      className="mobile-menu-btn"
      type="button"
      aria-expanded={isOpen}
      aria-controls="menu-links"
      aria-label="Toggle menu"
      onClick={onToggle}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}
