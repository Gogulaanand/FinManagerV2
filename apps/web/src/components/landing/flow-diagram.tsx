import styles from './landing-page.module.css';

const currentCards = [
  {
    className: styles.currentCardSpend,
    eyebrow: 'current · spend',
    title: 'Living & lifestyle',
    value: '₹1,12,000',
    note: 'The active stream.',
  },
  {
    className: styles.currentCardProtect,
    eyebrow: 'current · protect',
    title: 'Housing & utilities',
    value: '₹85,000',
    note: 'Stable outgoing current.',
  },
  {
    className: styles.currentCardGrow,
    eyebrow: 'current · grow',
    title: 'Long view holdings',
    value: '₹11,08,200',
    note: 'Compounding beneath the surface.',
  },
] as const;

/**
 * A CSS/SVG-only visual model of the three things a household manages every
 * month: what leaves, what keeps it steady, and what compounds over time.
 * It is deliberately data-shaped, but every number is marked illustrative.
 */
export function FlowDiagram() {
  return (
    <div className={styles.flowCanvas} role="group" aria-labelledby="flow-diagram-label">
      <p id="flow-diagram-label" className={styles.flowIllustrative}>
        Illustrative household metrics · FIRE 2035 is a sample planning horizon
      </p>
      <svg className={styles.flowLines} viewBox="0 0 220 780" aria-hidden="true">
        <defs>
          <linearGradient id="spend-current" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--line-spend)" stopOpacity="0.1" />
            <stop offset="0.28" stopColor="var(--line-spend)" stopOpacity="0.85" />
            <stop offset="1" stopColor="var(--line-spend)" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="protect-current" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--line-protect)" stopOpacity="0.1" />
            <stop offset="0.38" stopColor="var(--line-protect)" stopOpacity="0.75" />
            <stop offset="1" stopColor="var(--line-protect)" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="grow-current" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--line-grow)" stopOpacity="0.1" />
            <stop offset="0.45" stopColor="var(--line-grow)" stopOpacity="0.9" />
            <stop offset="1" stopColor="var(--line-grow)" stopOpacity="0.85" />
          </linearGradient>
          <filter id="current-glow" x="-200%" y="-20%" width="400%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d="M40 0 C40 182 56 235 40 390 S40 598 40 780" stroke="url(#spend-current)" />
        <path d="M110 0 C110 170 94 232 110 390 S110 604 110 780" stroke="url(#protect-current)" />
        <path d="M180 0 C180 186 164 230 180 390 S180 600 180 780" stroke="url(#grow-current)" />
        <g filter="url(#current-glow)" aria-hidden="true">
          <path d="M40 240 C40 298 46 343 40 390" stroke="var(--line-spend)" />
          <path d="M110 250 C110 308 104 350 110 390" stroke="var(--line-protect)" />
          <path d="M180 244 C180 301 174 348 180 390" stroke="var(--line-grow)" />
        </g>
      </svg>

      <div className={`${styles.flowStat} ${styles.flowStatSalary}`}>
        <span className={styles.flowStatEyebrow}>source · primary</span>
        <strong>Salary &amp; consulting</strong>
        <span className={styles.flowStatValue}>₹2,80,000</span>
      </div>

      <div className={`${styles.flowStat} ${styles.flowStatTotal}`}>
        <span className={styles.flowStatEyebrow}>total inflow</span>
        <strong>₹3,42,000</strong>
        <span className={styles.flowStatNote}>Illustrative household month</span>
      </div>

      <div className={`${styles.flowStat} ${styles.flowStatRental}`}>
        <span className={styles.flowStatEyebrow}>source · secondary</span>
        <strong>Rental yield</strong>
        <span className={styles.flowStatValue}>₹62,000</span>
      </div>

      {currentCards.map((card) => (
        <div key={card.eyebrow} className={`${styles.currentCard} ${card.className}`}>
          <span className={styles.currentEyebrow}>{card.eyebrow}</span>
          <strong>{card.title}</strong>
          <span className={styles.currentValue}>{card.value}</span>
          <span className={styles.currentNote}>{card.note}</span>
        </div>
      ))}

      <div className={`${styles.flowStat} ${styles.flowStatCash}`}>
        <span className={styles.flowStatEyebrow}>cash flow</span>
        <strong>₹1,45,000</strong>
      </div>

      <div className={`${styles.flowStat} ${styles.flowStatTax}`}>
        <span className={styles.flowStatEyebrow}>tax context</span>
        <strong>−₹82,600</strong>
      </div>

      <div className={styles.flowReconciliation}>
        <span className={styles.flowStatEyebrow}>reconciliation node</span>
        <strong>₹62,400</strong>
        <span>retained value this month</span>
      </div>
    </div>
  );
}
