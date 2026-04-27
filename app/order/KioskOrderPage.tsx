"use client";

import Image from "next/image";
import styles from "./KioskOrderPage.module.css";
import type { CartLine, MenuItem } from "../components/Order";

interface KioskOrderPageProps {
  activeCategory: "all" | string;
  onCategoryChange: (category: "all" | string) => void;
  items: MenuItem[];
  cartLines: CartLine[];
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
  categories?: Array<{ key: string; label: string }>;
}

interface CategoryConfig {
  id: string;
  label: string;
  Icon?: () => JSX.Element;
}

function CategoryAllIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6" cy="6" r="2" fill="currentColor" />
      <circle cx="12" cy="6" r="2" fill="currentColor" />
      <circle cx="18" cy="6" r="2" fill="currentColor" />
      <circle cx="6" cy="12" r="2" fill="currentColor" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <circle cx="18" cy="12" r="2" fill="currentColor" />
      <circle cx="6" cy="18" r="2" fill="currentColor" />
      <circle cx="12" cy="18" r="2" fill="currentColor" />
      <circle cx="18" cy="18" r="2" fill="currentColor" />
    </svg>
  );
}

function CategoryHotIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" fill="currentColor" />
    </svg>
  );
}

function CategoryColdIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" fill="currentColor" />
    </svg>
  );
}

function CategoryPastryIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 13h-8v8h8v-8zm0-2c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2h-5V1h-2v1h-5c-1.1 0-2 .9-2 2v5c0 1.1.9 2 2 2h5v1H7v2h5v1H7v2h12zM3 4h16v5H3V4z" fill="currentColor" />
    </svg>
  );
}

function CategoryHighlightsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" />
    </svg>
  );
}

const CATEGORY_ICONS: Record<string, () => JSX.Element> = {
  all: CategoryAllIcon,
  espresso: CategoryHotIcon,
  signature: CategoryColdIcon,
  bites: CategoryPastryIcon,
  highlights: CategoryHighlightsIcon
};

function getCategoryIcon(key: string): (() => JSX.Element) {
  return CATEGORY_ICONS[key] || (() => null);
}

const PRODUCT_SKELETON_COUNT = 8;

function formatPeso(value: number): string {
  return `PHP ${value.toFixed(2)}`;
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
  quantities,
  isMenuLoading,
  isHighlightsLoading,
  menuError,
  cartCount,
  grandTotal,
  isCartBumping,
  onQuickAdd,
  onCustomize,
  onViewCart,
  categories
}: KioskOrderPageProps) {
  // Build category list from props or use defaults
  const categoryList: Array<{ key: string; label: string }> = categories && categories.length > 0
    ? categories
    : [
        { key: "espresso", label: "Hot" },
        { key: "signature", label: "Cold" },
        { key: "bites", label: "Pastries" }
      ];

  const seenCategoryIds = new Set<string>(["all"]);
  const displayCategories: CategoryConfig[] = [{ id: "all", label: "All" }];

  categoryList.forEach((category) => {
    const normalizedId = category.key.trim().toLowerCase();
    if (!normalizedId || seenCategoryIds.has(normalizedId)) {
      return;
    }

    seenCategoryIds.add(normalizedId);
    displayCategories.push({ id: normalizedId, label: category.label });
  });
  return (
    <section className={styles.kioskWrapper} aria-label="Kiosk ordering interface">
      <div className={styles.kioskMainRow}>
        <aside className={styles.sidebar} aria-label="Menu categories">
          <div className={styles.sidebarLabel}>Categories</div>
          <div className={styles.categoryRail} role="tablist" aria-orientation="vertical" aria-label="Browse categories">
            {displayCategories.map((category) => {
              const isActive = category.id === activeCategory;
              const Icon = getCategoryIcon(category.id);

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
                    <Icon />
                  </span>
                  <span className={styles.categoryText}>{category.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className={styles.catalogPane} aria-live="polite">
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
            {isMenuLoading || (activeCategory === "highlights" && isHighlightsLoading) ? (
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
