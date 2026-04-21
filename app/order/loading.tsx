import styles from "./KioskOrderPage.module.css";

const CATEGORY_SKELETON_COUNT = 4;
const HIGHLIGHT_SKELETON_COUNT = 4;
const PRODUCT_SKELETON_COUNT = 8;

export default function Loading() {
  return (
    <section className={styles.kioskWrapper} aria-label="Loading kiosk ordering interface" aria-busy="true" aria-live="polite">
      <div className={styles.kioskMainRow}>
        <aside className={styles.sidebar} aria-hidden="true">
          <div className={`${styles.sidebarLabel} ${styles.skeletonShimmer} ${styles.sidebarLabelSkeleton}`} />
          <div className={styles.categoryRail}>
            {Array.from({ length: CATEGORY_SKELETON_COUNT }).map((_, index) => (
              <div key={`category-skeleton-${index}`} className={`${styles.categoryButton} ${styles.categoryButtonSkeleton}`}>
                <span className={`${styles.categoryIcon} ${styles.skeletonShimmer} ${styles.categoryIconSkeleton}`} />
                <span className={`${styles.skeletonShimmer} ${styles.categoryTextSkeleton}`} />
              </div>
            ))}
          </div>
        </aside>

        <section className={styles.catalogPane}>
          <header className={styles.condensedHero}>
            <div className={styles.heroHead}>
              <div className={`${styles.skeletonShimmer} ${styles.heroHeadingSkeleton}`} />
              <span className={`${styles.heroMeta} ${styles.skeletonShimmer} ${styles.heroMetaSkeleton}`} />
            </div>

            <div className={styles.heroCardRow}>
              {Array.from({ length: HIGHLIGHT_SKELETON_COUNT }).map((_, index) => (
                <article key={`highlight-skeleton-${index}`} className={`${styles.heroCard} ${styles.heroCardSkeleton}`} aria-hidden="true">
                  <div>
                    <div className={`${styles.skeletonShimmer} ${styles.heroTitleSkeleton}`} />
                    <div className={`${styles.skeletonShimmer} ${styles.heroPriceSkeleton}`} />
                  </div>
                  <div className={`${styles.skeletonShimmer} ${styles.heroActionSkeleton}`} />
                </article>
              ))}
            </div>
          </header>

          <div className={styles.desktopCartCta}>
            <div className={`${styles.desktopViewCartFab} ${styles.skeletonShimmer} ${styles.desktopViewCartFabSkeleton}`} aria-hidden="true" />
          </div>

          <div className={styles.catalogScroll}>
            <div className={styles.productGrid} role="status" aria-live="polite" aria-label="Loading menu items">
              {Array.from({ length: PRODUCT_SKELETON_COUNT }).map((_, index) => (
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
          </div>
        </section>
      </div>

      <div className={styles.mobileTray} aria-hidden="true">
        <div className={styles.mobileTraySkeletonCopy}>
          <div className={`${styles.skeletonShimmer} ${styles.mobileTraySkeletonLine}`} />
          <div className={`${styles.skeletonShimmer} ${styles.mobileTraySkeletonStrong}`} />
        </div>
        <div className={`${styles.skeletonShimmer} ${styles.mobileTraySkeletonButton}`} />
      </div>
    </section>
  );
}
