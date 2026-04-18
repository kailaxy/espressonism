import { Skeleton, SkeletonGroup, SkeletonListRow, SkeletonPageSection } from "./components";

export default function Loading() {
  return (
    <div className="shell" aria-busy="true" aria-live="polite">
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

        <section className="section">
          <SkeletonPageSection titleWidth="34%" lineCount={2} lineWidths={["62%", "48%"]} includeMedia mediaHeight="12rem" />
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

        <section className="section" id="testimonials">
          <SkeletonPageSection titleWidth="26%" lineCount={2} lineWidths={["68%", "52%"]} />
          <SkeletonGroup>
            <SkeletonListRow />
            <SkeletonListRow />
            <SkeletonListRow />
          </SkeletonGroup>
        </section>
      </main>
    </div>
  );
}
