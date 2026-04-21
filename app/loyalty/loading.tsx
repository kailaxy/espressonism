import { Skeleton, SkeletonGroup, SkeletonListRow } from "../components";

export default function Loading() {
  return (
    <div className="shell loyalty-page-shell" aria-busy="true" aria-live="polite">
      <header className="topbar" aria-hidden="true">
        <Skeleton type="text" width="10.5rem" height="1.2rem" />
        <Skeleton type="text" width="15rem" height="1rem" />
        <Skeleton type="block" width="8.5rem" height="2.4rem" />
      </header>

      <main className="loyalty-page-main">
        <section className="loyalty-page-headline" aria-hidden="true">
          <SkeletonGroup>
            <Skeleton type="text" width="28%" height="0.95rem" />
            <Skeleton type="text" width="42%" height="2.8rem" />
            <Skeleton type="text" width="74%" />
            <Skeleton type="text" width="62%" />
          </SkeletonGroup>
        </section>

        <section className="loyalty-page-panel" aria-hidden="true">
          <div className="loyalty-experience loyalty-page-experience">
            <article className="loyalty-pass">
              <SkeletonGroup>
                <Skeleton type="text" width="36%" height="0.95rem" />
                <Skeleton type="text" width="58%" height="1.5rem" />
                <Skeleton type="text" width="92%" />
                <div className="loyalty-stamp-grid loyalty-stamp-grid-five">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={`loyalty-route-stamp-loading-${index}`} type="block" height="3.75rem" />
                  ))}
                </div>
                <Skeleton type="text" width="52%" />
              </SkeletonGroup>
            </article>

            <aside className="loyalty-details loyalty-profile-sync">
              <SkeletonGroup>
                <Skeleton type="text" width="48%" height="1.1rem" />
                <SkeletonListRow />
                <SkeletonListRow />
                <SkeletonListRow />
                <Skeleton type="block" width="100%" height="2.3rem" />
              </SkeletonGroup>
            </aside>
          </div>
        </section>

        <section className="loyalty-history" aria-hidden="true">
          <div className="loyalty-history-head">
            <Skeleton type="text" width="46%" height="1.55rem" />
            <Skeleton type="text" width="70%" />
          </div>

          <ul className="loyalty-history-list">
            {Array.from({ length: 3 }).map((_, index) => (
              <li className="loyalty-history-item" key={`loyalty-route-history-loading-${index}`}>
                <div className="loyalty-history-summary">
                  <div className="loyalty-history-top">
                    <div className="loyalty-history-main">
                      <Skeleton type="text" width="8.2rem" />
                      <Skeleton type="text" width="7.2rem" />
                    </div>
                    <Skeleton type="text" width="5.2rem" />
                  </div>
                  <div className="loyalty-history-summary-line">
                    <Skeleton type="block" width="5.4rem" height="1.2rem" />
                    <Skeleton type="block" width="4.8rem" height="1.2rem" />
                    <Skeleton type="block" width="4.2rem" height="1.2rem" />
                    <Skeleton type="block" width="6.8rem" height="1.2rem" />
                  </div>
                  <Skeleton type="text" width="6.9rem" />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}