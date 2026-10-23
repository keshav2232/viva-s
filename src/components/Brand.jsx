import styles from "./Brand.module.css";

/** Shared landing-page wordmark, with the practice setup's AI accent. */
export default function Brand({ as: Element = "span", className = "", ...props }) {
  return (
    <Element {...props} className={`${styles.brand} ${className}`}>
      <svg width="30" height="32" viewBox="0 0 30 32" fill="none" aria-hidden="true">
        <path d="M3 6 15 0l12 6v14l-12 7V14l12-8M3 6v20l12 6v-5M3 6l12 8" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      </svg>
      <span className={styles.name}>PrepSim</span>
      <span className={styles.ai}>AI</span>
    </Element>
  );
}
