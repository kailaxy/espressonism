import { Skeleton, SkeletonFormBlock, SkeletonPageSection, SkeletonTableRow } from "../components";

export default function Loading() {
  return (
    <main className="barista-dashboard" aria-busy="true" aria-live="polite">
      <header className="barista-dashboard-header">
        <div className="barista-dashboard-header-top">
          <Skeleton type="text" width="7.5rem" />
          <Skeleton type="block" width="5rem" height="2.15rem" />
        </div>
        <Skeleton type="text" width="16rem" height="2.4rem" />
        <Skeleton type="text" width="26rem" />
      </header>

      <nav className="barista-tab-nav" aria-label="Dashboard sections loading state">
        <Skeleton type="block" width="7rem" height="2.4rem" />
        <Skeleton type="block" width="7rem" height="2.4rem" />
        <Skeleton type="block" width="8rem" height="2.4rem" />
        <Skeleton type="block" width="8rem" height="2.4rem" />
        <Skeleton type="block" width="7rem" height="2.4rem" />
        <Skeleton type="block" width="6.5rem" height="2.4rem" />
      </nav>

      <section className="barista-tab-content">
        <section className="barista-orders-panel" aria-label="Loading active order board">
          <section className="barista-grid" aria-busy="true">
            <article className="barista-column board-preparing">
              <header className="barista-column-header">
                <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  <p>In progress</p>
                  <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>
                    PREPARING
                  </h2>
                </div>
                <Skeleton type="text" width={28} />
              </header>

              <div className="barista-column-list">
                {Array.from({ length: 2 }).map((_, index) => (
                  <SkeletonPageSection
                    key={`admin-order-loading-preparing-${index}`}
                    className="barista-order-card"
                    titleWidth="48%"
                    lineCount={5}
                    lineWidths={["58%", "100%", "92%", "74%", "48%"]}
                  />
                ))}
              </div>
            </article>

            <article className="barista-column board-new">
              <header className="barista-column-header">
                <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  <p>Just placed</p>
                  <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>
                    NEW ORDERS
                  </h2>
                </div>
                <Skeleton type="text" width={28} />
              </header>

              <div className="barista-column-list">
                {Array.from({ length: 2 }).map((_, index) => (
                  <SkeletonPageSection
                    key={`admin-order-loading-received-${index}`}
                    className="barista-order-card"
                    titleWidth="48%"
                    lineCount={5}
                    lineWidths={["58%", "100%", "92%", "74%", "48%"]}
                  />
                ))}
              </div>
            </article>

            <article className="barista-column board-ready">
              <header className="barista-column-header">
                <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  <p>Pickup / handoff</p>
                  <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    READY FOR PICKUP
                  </h2>
                </div>
                <Skeleton type="text" width={28} />
              </header>

              <div className="barista-column-list">
                {Array.from({ length: 2 }).map((_, index) => (
                  <SkeletonPageSection
                    key={`admin-order-loading-ready-${index}`}
                    className="barista-order-card"
                    titleWidth="48%"
                    lineCount={5}
                    lineWidths={["58%", "100%", "92%", "74%", "48%"]}
                  />
                ))}
              </div>
            </article>
          </section>

          <div className="barista-menu-table-wrap" style={{ marginTop: "1rem" }}>
            <SkeletonPageSection titleWidth="36%" lineCount={2} lineWidths={["52%", "70%"]} />
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonTableRow key={`admin-table-loading-${index}`} columns={6} columnWidths={["18%", "14%", "30%", "12%", "14%", "12%"]} />
            ))}
          </div>

          <div className="barista-manager-form barista-manager-form-stretch" style={{ marginTop: "1rem" }}>
            <SkeletonFormBlock fields={4} />
          </div>
        </section>
      </section>
    </main>
  );
}
