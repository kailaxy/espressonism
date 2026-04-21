"use client";

import Image from "next/image";
import styles from "./KioskOrderPage.module.css";
import type { CartLine, MenuItem } from "../components/Order";

type KioskCategory = "all" | MenuItem["category"];

interface KioskOrderPageProps {
  activeCategory: KioskCategory;
  onCategoryChange: (category: KioskCategory) => void;
  items: MenuItem[];
  cartLines: CartLine[];
  highlightItems: MenuItem[];
  quantities: Record<string, number>;
  isMenuLoading: boolean;
  isHighlightsLoading: boolean;
  menuError: string | null;
  cartCount: number;
  grandTotal: number;
  isCartBumping: boolean;
  onQuickAdd: (item: MenuItem) => void;
  onCustomize: (item: MenuItem) => void;
  onViewCart: () => void;
}

interface CategoryConfig {
  id: KioskCategory;
  label: string;
  Icon: () => JSX.Element;
}

function CategoryAllIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="6" height="6" rx="1.2" />
      <rect x="14" y="4" width="6" height="6" rx="1.2" />
      <rect x="4" y="14" width="6" height="6" rx="1.2" />
      <rect x="14" y="14" width="6" height="6" rx="1.2" />
    </svg>
  );
}

function CategoryHotIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 9.5h10.5a2.5 2.5 0 0 1 0 5H14v.7a3.7 3.7 0 0 1-3.7 3.8H8.7A3.7 3.7 0 0 1 5 15.2V9.5Z" />
      <path d="M8 5.2c.8.9.8 1.8 0 2.7M11 4.4c.8.9.8 1.8 0 2.7M14 5.2c.8.9.8 1.8 0 2.7" fill="none" />
      <path d="M5 19h10" fill="none" />
    </svg>
  );
}

function CategoryColdIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M9.2 4.5h5.6l-.6 2h2.5a1.4 1.4 0 0 1 1.4 1.6l-1.2 9.5a2.2 2.2 0 0 1-2.2 1.9H9.3a2.2 2.2 0 0 1-2.2-1.9L5.9 8.1a1.4 1.4 0 0 1 1.4-1.6h2.5l-.6-2Z" />
      <path d="M9.4 11.8h5.2M10.2 14.4h3.6" fill="none" />
    </svg>
  );
}

function CategoryPastryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3.8 15.3c2.1-6 6.5-9.2 13.2-9.7 2.6-.2 3.8 2.8 2 4.5-1.7 1.6-3.9 3.8-6.2 7.3H3.8Z" />
      <path d="M8 12.2c1.7.2 3.4.7 4.8 1.6M10.3 9.9c1.4.2 2.8.6 4 1.2" fill="none" />
    </svg>
  );
}

const CATEGORIES: CategoryConfig[] = [
  { id: "all", label: "All", Icon: CategoryAllIcon },
  { id: "espresso", label: "Hot", Icon: CategoryHotIcon },
  { id: "signature", label: "Cold", Icon: CategoryColdIcon },
  { id: "bites", label: "Pastries", Icon: CategoryPastryIcon }
];

const HIGHLIGHT_SKELETON_COUNT = 4;
const PRODUCT_SKELETON_COUNT = 8;

function formatPeso(value: number): string {
  return `PHP ${value.toFixed(2)}`;
}

function KioskHighlightSkeletonCards() {
  return (
    <>
      {Array.from({ length: HIGHLIGHT_SKELETON_COUNT }).map((_, index) => (
        <article key={`highlight-skeleton-${index}`} className={`${styles.heroCard} ${styles.heroCardSkeleton}`} aria-hidden="true">
          <div>
            <div className={`${styles.skeletonShimmer} ${styles.heroTitleSkeleton}`} />
            <div className={`${styles.skeletonShimmer} ${styles.heroPriceSkeleton}`} />
          </div>
          <div className={`${styles.skeletonShimmer} ${styles.heroActionSkeleton}`} />
        </article>
      ))}
    </>
  );
}

function KioskProductGridSkeleton({
  count = PRODUCT_SKELETON_COUNT,
  statusLabel = "Loading menu items"
}: {
  count?: number;
  statusLabel?: string;
}) {
  return (
    <div className={styles.productGrid} role="status" aria-live="polite" aria-label={statusLabel}>
      {Array.from({ length: count }).map((_, index) => (
        <article key={`product-skeleton-${index}`} className={`${styles.productCard} ${styles.productCardSkeleton}`} aria-hidden="true">
          <div className={styles.productMedia}>
            <div className={`${styles.skeletonShimmer} ${styles.productMediaSkeleton}`} />
          </div>

          <div className={styles.productBody}>
            <div className={`${styles.skeletonShimmer} ${styles.productCategorySkeleton}`} />
            <div className={`${styles.skeletonShimmer} ${styles.productTitleSkeleton}`} />
            <div className={`${styles.skeletonShimmer} ${styles.productDescriptionSkeleton}`} />
            <div className={`${styles.skeletonShimmer} ${styles.productDescriptionSkeleton} ${styles.productDescriptionSkeletonShort}`} />
            <div className={`${styles.skeletonShimmer} ${styles.productPriceSkeleton}`} />
          </div>

          <div className={styles.productActions}>
            <div className={`${styles.skeletonShimmer} ${styles.actionSkeleton}`} />
            <div className={`${styles.skeletonShimmer} ${styles.actionSkeleton}`} />
          </div>

          <div className={`${styles.skeletonShimmer} ${styles.inCartPillSkeleton}`} />
        </article>
      ))}
    </div>
  );
}

export default function KioskOrderPage({
  activeCategory,
  onCategoryChange,
  items,
  highlightItems,
  quantities,
  isMenuLoading,
  isHighlightsLoading,
  menuError,
  cartCount,
  grandTotal,
  isCartBumping,
  onQuickAdd,
  onCustomize,
  onViewCart
}: KioskOrderPageProps) {
  return (
    <section className={styles.kioskWrapper} aria-label="Kiosk ordering interface">
      <div className={styles.kioskMainRow}>
        <aside className={styles.sidebar} aria-label="Menu categories">
          <div className={styles.sidebarLabel}>Categories</div>
          <div className={styles.categoryRail} role="tablist" aria-orientation="vertical" aria-label="Browse categories">
            {CATEGORIES.map((category) => {
              const isActive = category.id === activeCategory;

              return (
                <button
                  key={category.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`${styles.categoryButton} ${isActive ? styles.categoryButtonActive : ""}`}
                  onClick={() => onCategoryChange(category.id)}
                >
                  <span className={styles.categoryIcon}>
                    <category.Icon />
                  </span>
                  <span className={styles.categoryText}>{category.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className={styles.catalogPane} aria-live="polite">
          <header className={styles.condensedHero}>
            <div className={styles.heroHead}>
              <h2>Today Highlights</h2>
              {isHighlightsLoading ? <span className={`${styles.heroMeta} ${styles.skeletonShimmer} ${styles.heroMetaSkeleton}`} aria-hidden="true" /> : null}
            </div>
            <div className={styles.heroCardRow}>
              {isHighlightsLoading
                ? <KioskHighlightSkeletonCards />
                : highlightItems.map((item) => (
                  <article key={`highlight-${item.id}`} className={styles.heroCard}>
                    <div>
                      <h3>{item.name}</h3>
                      <p>{formatPeso(item.price)}</p>
                    </div>
                    <button type="button" onClick={() => onQuickAdd(item)}>
                      Add
                    </button>
                  </article>
                ))}
            </div>
          </header>

          <div className={styles.desktopCartCta}>
            <button
              type="button"
              className={`${styles.desktopViewCartFab} ${isCartBumping ? styles.desktopFabBump : ""}`}
              onClick={onViewCart}
            >
              View Cart ({cartCount})
            </button>
          </div>

          <div className={styles.catalogScroll}>
            {isMenuLoading ? (
              <KioskProductGridSkeleton />
            ) : menuError ? (
              <div className={styles.statusBox} role="alert">{menuError}</div>
            ) : items.length === 0 ? (
              <div className={styles.statusBox}>No menu items found for this category.</div>
            ) : (
              <div className={styles.productGrid}>
                {items.map((item) => {
                  const quantity = quantities[item.id] ?? 0;

                  return (
                    <article key={item.id} className={styles.productCard}>
                      <div className={styles.productMedia}>
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.name}
                            fill
                            sizes="(max-width: 767px) 48vw, (max-width: 1279px) 24vw, 16vw"
                            unoptimized
                          />
                        ) : (
                          <div className={styles.productPlaceholder}>No image</div>
                        )}
                      </div>

                      <div className={styles.productBody}>
                        <p className={styles.productCategory}>{item.category}</p>
                        <h3>{item.name}</h3>
                        <p className={styles.productDescription}>{item.description}</p>
                        <p className={styles.productPrice}>{formatPeso(item.price)}</p>
                      </div>

                      <div className={styles.productActions}>
                        <button type="button" className={styles.quickAddButton} onClick={() => onQuickAdd(item)}>
                          Add
                        </button>
                        <button type="button" className={styles.customizeButton} onClick={() => onCustomize(item)}>
                          Customize
                        </button>
                      </div>

                      {quantity > 0 ? <p className={styles.inCartPill}>In cart: {quantity}</p> : null}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className={styles.mobileTray}>
        <div>
          <p>{cartCount} item{cartCount === 1 ? "" : "s"}</p>
          <strong>{formatPeso(grandTotal)}</strong>
        </div>
        <button type="button" className={`${styles.viewCartButton} ${isCartBumping ? styles.bump : ""}`} onClick={onViewCart}>
          View Cart
        </button>
      </div>
    </section>
  );
}
