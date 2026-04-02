interface LoyaltyProgram {
  title: string;
  description: string;
  rule: string;
  punchesRequired: number;
  rewardLabel: string;
  notes: string[];
}

interface LoyaltyCardProps {
  program: LoyaltyProgram;
}

export function LoyaltyCard({ program }: LoyaltyCardProps) {
  return (
    <div className="loyalty-experience">
      <article className="loyalty-pass" aria-label="Espressonism loyalty passport card">
        <header className="loyalty-pass-header">
          <p className="loyalty-pass-kicker">Espressonism Coffee Passport</p>
          <h3>{program.title}</h3>
          <p className="loyalty-pass-subtitle">{program.description}</p>
        </header>

        <div className="loyalty-stamp-grid" role="list" aria-label={program.rule}>
          {Array.from({ length: program.punchesRequired }).map((_, index) => (
            <div key={`stamp-${index + 1}`} className="loyalty-stamp" role="listitem" aria-label={`Stamp ${index + 1}`}>
              <span>{index + 1}</span>
            </div>
          ))}
          <div className="loyalty-stamp loyalty-stamp-reward" role="listitem" aria-label="Free coffee reward">
            <span>FREE</span>
          </div>
        </div>

        <p className="loyalty-pass-rule">{program.rule}</p>
      </article>

      <aside className="loyalty-details">
        <h4>How It Works</h4>
        <ul>
          {program.notes.map((note) => (
            <li key={note}>
              <span className="loyalty-dot" aria-hidden="true" />
              {note}
            </li>
          ))}
        </ul>
        <p className="loyalty-details-reward">{program.rewardLabel}</p>
      </aside>
    </div>
  );
}

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface FeatureGridProps {
  features: Feature[];
}

export function FeatureGrid({ features }: FeatureGridProps) {
  return (
    <div className="feature-grid">
      {features.map((feature) => (
        <article className="feature" key={feature.title} tabIndex={0}>
          <div className="feature-icon">{feature.icon}</div>
          <h3>{feature.title}</h3>
          <p>{feature.description}</p>
        </article>
      ))}
    </div>
  );
}

interface BottomCTAProps {
  title: string;
  description: string;
  buttonLabel: string;
  mapContent: React.ReactNode;
}

export function VisitSection({ title, description, buttonLabel, mapContent }: BottomCTAProps) {
  const handleGetDirections = () => {
    window.open(
      "https://www.google.com/maps/place/espressonism/@14.5809759,121.0287333,17z/data=!3m1!4b1!4m8!3m7!1s0x3397c99fa0974bc5:0xa8ae7b06dab1eef6!8m2!3d14.5809759!4d121.0313082!9m1!1b1!16s%2Fg%2F11v11xz_c7?entry=ttu&g_ep=EgoyMDI2MDMyOS4wIKXMDSoASAFQAw%3D%3D",
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <>
      <div className="bottom-cta">
        <div>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <p>{description}</p>
        </div>
        <button className="cta" type="button" onClick={handleGetDirections}>
          {buttonLabel}
        </button>
      </div>

      <div className="map-wrap" aria-label="Map to Espressonism">
        {mapContent}
      </div>
    </>
  );
}
