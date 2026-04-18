import { Skeleton, SkeletonGroup, SkeletonListRow, SkeletonPageSection } from "../components";

export default function Loading() {
  return (
    <div className="shell order-page-v2" aria-busy="true" aria-live="polite">
      <main className="order-shell">
        <section className="hero">
          <div className="hero-copy">
            <SkeletonGroup>
              <Skeleton type="text" width="30%" height="0.95rem" />
              <Skeleton type="text" width="58%" height="2.4rem" />
              <Skeleton type="text" width="86%" />
              <Skeleton type="text" width="74%" />
            </SkeletonGroup>
          </div>

          <div className="hero-card">
            <SkeletonGroup className="order-highlight-list">
              <Skeleton type="text" width="44%" height="1.35rem" />
              <Skeleton type="text" width="86%" />
              {Array.from({ length: 4 }).map((_, index) => (
                <SkeletonListRow key={`order-highlight-loading-${index}`} />
              ))}
            </SkeletonGroup>
          </div>
        </section>

        <section className="order-main-grid order-main-grid-single" id="order-menu">
          <div>
            <div style={{ marginBottom: "0.9rem" }}>
              <SkeletonGroup>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <Skeleton type="block" width="5.2rem" height="2.25rem" />
                  <Skeleton type="block" width="6.1rem" height="2.25rem" />
                  <Skeleton type="block" width="5.4rem" height="2.25rem" />
                  <Skeleton type="block" width="4.5rem" height="2.25rem" />
                </div>
              </SkeletonGroup>
            </div>

            <SkeletonGroup className="order-menu-grid-v2">
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonPageSection
                  key={`order-menu-loading-${index}`}
                  className="order-menu-card-v2"
                  includeMedia
                  mediaHeight="12rem"
                  titleWidth="58%"
                  lineCount={4}
                  lineWidths={["38%", "100%", "84%", "52%"]}
                />
              ))}
            </SkeletonGroup>
          </div>
        </section>
      </main>
    </div>
  );
}
