import styles from './landing-page.module.css';

/**
 * The household flow is deliberately data-shaped rather than a decorative
 * illustration. The three strands are rendered in CSS so they can respond to
 * reduced-motion preferences without relying on an SVG animation.
 */
export function FlowDiagram() {
  return (
    <div className={styles.flowCanvas} role="group" aria-labelledby="flow-diagram-label">
      <p id="flow-diagram-label" className={styles.srOnly}>
        Illustrative household inflow, outgoing currents, and retained value.
      </p>

      <div className={styles.braid} aria-hidden="true">
        <span
          className={`${styles.braidStrand} ${styles.braidStrandOne}`}
          data-braid-strand="weave1"
        />
        <span
          className={`${styles.braidStrand} ${styles.braidStrandTwo}`}
          data-braid-strand="weave2"
        />
        <span
          className={`${styles.braidStrand} ${styles.braidStrandThree}`}
          data-braid-strand="weave3"
        />
      </div>

      <div className={`${styles.flowStat} ${styles.flowStatSalary}`}>
        <span className={styles.flowStatEyebrow}>source: primary</span>
        <strong>Salary &amp; Consulting</strong>
        <span className={styles.flowStatValue}>₹2,80,000</span>
      </div>

      <div className={`${styles.flowStat} ${styles.flowStatTotal}`}>
        <span className={styles.flowStatEyebrow}>total inflow</span>
        <strong>₹3,42,000</strong>
      </div>

      <div className={`${styles.flowStat} ${styles.flowStatRental}`}>
        <span className={styles.flowStatEyebrow}>source: secondary</span>
        <strong>Rental Yield</strong>
        <span className={styles.flowStatValue}>₹62,000</span>
      </div>

      <div className={`${styles.currentCard} ${styles.currentCardFixed}`}>
        <span className={styles.currentEyebrow}>current: fixed</span>
        <strong>Housing &amp; Utilities</strong>
        <span className={styles.currentValue}>₹85,000</span>
        <span className={styles.currentNote}>Stable outgoing current.</span>
      </div>

      <div className={`${styles.currentCard} ${styles.currentCardVariable}`}>
        <span className={styles.currentEyebrow}>current: variable</span>
        <strong>Living &amp; Lifestyle</strong>
        <span className={styles.currentValue}>₹1,12,000</span>
        <span className={styles.currentNote}>The active stream.</span>
      </div>

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
        <span className={styles.flowRetainedEyebrow}>retained value</span>
        <strong>₹62,400</strong>
      </div>
    </div>
  );
}
