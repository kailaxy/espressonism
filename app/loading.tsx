import { Skeleton, SkeletonGroup, SkeletonListRow, SkeletonPageSection } from "./components";

export default function Loading() {
  return (
    <div className="shell home-shell" aria-busy="true" aria-live="polite">
      <header className="topbar" aria-hidden="true">
        <Skeleton type="text" width="10.5rem" height="1.2rem" />
        <Skeleton type="text" width="19rem" height="1rem" />
        <Skeleton type="block" width="8.75rem" height="2.4rem" />
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <SkeletonGroup>
              <Skeleton type="text" width="32%" height="0.95rem" />
              <Skeleton type="text" width="62%" height="2.5rem" />
              <Skeleton type="text" width="88%" />
              <Skeleton type="text" width="76%" />
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem" }}>
                <Skeleton type="block" width="11rem" height="2.8rem" />
                <Skeleton type="block" width="10rem" height="2.8rem" />
              </div>
            </SkeletonGroup>
          </div>
          <div className="hero-card">
            <SkeletonPageSection titleWidth="52%" lineCount={5} lineWidths={["96%", "86%", "52%", "72%", "44%"]} />
          </div>
        </section>

        <section className="section" id="order-cta">
          <div className="order-cta-section order-cta-section-top">
            <div className="order-cta-content">
              <SkeletonGroup>
                <Skeleton type="text" width="38%" height="2.6rem" />
                <Skeleton type="text" width="56%" />
                <div style={{ display: "grid", placeItems: "center" }}>
                  <Skeleton type="block" width="11rem" height="2.9rem" />
                </div>
              </SkeletonGroup>
            </div>
          </div>
        </section>

        <section className="section" id="method">
          <SkeletonPageSection titleWidth="34%" lineCount={2} lineWidths={["62%", "48%"]} />
          <div className="feature-grid" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, index) => (
              <article className="feature" key={`home-method-loading-${index}`}>
                <SkeletonGroup>
                  <Skeleton type="block" width="1.8rem" height="1.8rem" />
                  <Skeleton type="text" width="64%" height="1.2rem" />
                  <Skeleton type="text" width="94%" />
                  <Skeleton type="text" width="78%" />
                </SkeletonGroup>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="signature">
          <SkeletonPageSection titleWidth="28%" lineCount={2} lineWidths={["70%", "54%"]} />
          <div className="signature-grid">
            {Array.from({ length: 2 }).map((_, index) => (
              <article className="signature-card" key={`home-signature-loading-${index}`}>
                <SkeletonGroup>
                  <Skeleton type="block" width="100%" height="11rem" />
                  <Skeleton type="text" width="58%" height="1.4rem" />
                  <Skeleton type="text" width="34%" />
                  <Skeleton type="text" width="92%" />
                </SkeletonGroup>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="gallery">
          <SkeletonPageSection titleWidth="22%" lineCount={1} lineWidths={["66%"]} />
          <div className="gallery-widget-shell">
            <div className="gallery-widget-frame" style={{ padding: "0.95rem" }}>
              <SkeletonGroup>
                <Skeleton type="text" width="42%" height="1.1rem" />
                <Skeleton type="text" width="88%" />
                <Skeleton type="block" width="100%" height="9.5rem" />
                <Skeleton type="block" width="100%" height="9.5rem" />
              </SkeletonGroup>
            </div>
          </div>
        </section>

        <section className="section" id="testimonials">
          <SkeletonPageSection titleWidth="26%" lineCount={2} lineWidths={["68%", "52%"]} />
          <div className="google-reviews" aria-hidden="true">
            <div className="google-reviews-list" role="list">
              {Array.from({ length: 3 }).map((_, index) => (
                <article className="google-review-card" role="listitem" key={`home-review-loading-${index}`}>
                  <SkeletonGroup>
                    <SkeletonListRow withAvatar />
                    <Skeleton type="text" width="100%" />
                    <Skeleton type="text" width="85%" />
                    <Skeleton type="text" width="65%" />
                  </SkeletonGroup>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="visit">
          <div className="bottom-cta">
            <div>
              <Skeleton type="text" width="36%" height="2rem" />
              <Skeleton type="text" width="74%" />
              <Skeleton type="text" width="58%" />
            </div>
            <Skeleton type="block" width="10rem" height="2.8rem" />
          </div>
        </section>
      </main>
    </div>
  );
}
