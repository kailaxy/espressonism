import { ReactNode } from "react";

// --- Mobile Menu ---
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

// --- Skeleton Primitives ---

export interface SkeletonProps {
  className?: string;
  type?: "text" | "block" | "media";
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className = "", type = "text", width, height }: SkeletonProps) {
  const baseClass = type === "media" ? "skeleton skeleton-media" : type === "text" ? "skeleton skeleton-text" : "skeleton skeleton-block";
  const inlineStyles: React.CSSProperties = { width, height };

  return <div className={`${baseClass} ${className}`} style={inlineStyles} aria-hidden="true" />;
}

export function SkeletonGroup({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`skeleton-group ${className}`} role="status" aria-label="Loading" aria-live="polite">
      {children}
    </div>
  );
}

export interface SkeletonPageSectionProps {
  className?: string;
  titleWidth?: string | number;
  lineCount?: number;
  lineWidths?: Array<string | number>;
  includeMedia?: boolean;
  mediaHeight?: string | number;
}

export function SkeletonPageSection({
  className = "",
  titleWidth = "40%",
  lineCount = 3,
  lineWidths,
  includeMedia = false,
  mediaHeight = "12rem",
}: SkeletonPageSectionProps) {
  return (
    <SkeletonGroup className={`skeleton-page-section ${className}`}>
      {includeMedia ? <Skeleton type="block" className="skeleton-section-media" height={mediaHeight} /> : null}
      <Skeleton type="text" className="skeleton-section-title" width={titleWidth} />
      <div className="skeleton-section-lines">
        {Array.from({ length: lineCount }).map((_, index) => (
          <Skeleton
            key={`section-line-${index}`}
            type="text"
            className="skeleton-section-line"
            width={lineWidths?.[index] ?? (index === lineCount - 1 ? "72%" : "100%")}
          />
        ))}
      </div>
    </SkeletonGroup>
  );
}

export interface SkeletonListRowProps {
  className?: string;
  withAvatar?: boolean;
}

export function SkeletonListRow({ className = "", withAvatar = false }: SkeletonListRowProps) {
  return (
    <div className={`skeleton-list-row ${className}`} aria-hidden="true">
      {withAvatar ? <Skeleton type="block" className="skeleton-list-avatar" width="2.25rem" height="2.25rem" /> : null}
      <div className="skeleton-list-content">
        <Skeleton type="text" className="skeleton-list-line" width="58%" />
        <Skeleton type="text" className="skeleton-list-line" width="38%" />
      </div>
      <Skeleton type="text" className="skeleton-list-meta" width="4.5rem" />
    </div>
  );
}

export interface SkeletonTableRowProps {
  className?: string;
  columns?: number;
  columnWidths?: Array<string | number>;
}

export function SkeletonTableRow({ className = "", columns = 4, columnWidths }: SkeletonTableRowProps) {
  return (
    <div className={`skeleton-table-row ${className}`} aria-hidden="true">
      {Array.from({ length: columns }).map((_, index) => (
        <Skeleton
          key={`table-col-${index}`}
          type="text"
          className="skeleton-table-cell"
          width={columnWidths?.[index] ?? "100%"}
        />
      ))}
    </div>
  );
}

export interface SkeletonFormBlockProps {
  className?: string;
  fields?: number;
}

export function SkeletonFormBlock({ className = "", fields = 3 }: SkeletonFormBlockProps) {
  return (
    <SkeletonGroup className={`skeleton-form-block ${className}`}>
      {Array.from({ length: fields }).map((_, index) => (
        <div key={`form-field-${index}`} className="skeleton-form-field">
          <Skeleton type="text" className="skeleton-form-label" width="28%" />
          <Skeleton type="block" className="skeleton-form-input" height="2.75rem" />
          <Skeleton type="text" className="skeleton-form-helper" width="44%" />
        </div>
      ))}
    </SkeletonGroup>
  );
}

export interface SkeletonModalBodyProps {
  className?: string;
  sections?: number;
}

export function SkeletonModalBody({ className = "", sections = 2 }: SkeletonModalBodyProps) {
  return (
    <SkeletonGroup className={`skeleton-modal-body ${className}`}>
      <Skeleton type="text" className="skeleton-modal-title" width="52%" />
      <Skeleton type="text" className="skeleton-modal-subtitle" width="72%" />
      {Array.from({ length: sections }).map((_, index) => (
        <div key={`modal-section-${index}`} className="skeleton-modal-section">
          <Skeleton type="text" className="skeleton-modal-section-title" width="36%" />
          <Skeleton type="text" className="skeleton-modal-section-line" width="100%" />
          <Skeleton type="text" className="skeleton-modal-section-line" width="85%" />
        </div>
      ))}
      <div className="skeleton-modal-actions">
        <Skeleton type="block" className="skeleton-modal-action" height="2.75rem" />
        <Skeleton type="block" className="skeleton-modal-action" height="2.75rem" />
      </div>
    </SkeletonGroup>
  );
}

export interface SkeletonCardProps {
  className?: string;
  includeMedia?: boolean;
  mediaHeight?: string | number;
  lines?: number;
}

export function SkeletonCard({ className = "", includeMedia = true, mediaHeight = "10rem", lines = 2 }: SkeletonCardProps) {
  return (
    <SkeletonGroup className={`skeleton-card ${className}`}>
      {includeMedia && <Skeleton type="media" className="skeleton-card-media" height={mediaHeight} />}
      <div className="skeleton-card-content">
        <Skeleton type="text" className="skeleton-card-title" width="60%" />
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={`card-line-${i}`} type="text" className="skeleton-card-line" width={i === lines - 1 ? "80%" : "100%"} />
        ))}
      </div>
    </SkeletonGroup>
  );
}
