import Link from "next/link";

/** Privacy / Terms / Contact links shown in every footer. */
export default function LegalLinks({ className = "" }) {
  return (
    <nav className={`legal-links ${className}`.trim()} aria-label="Legal and support">
      <Link href="/privacy">Privacy</Link>
      <Link href="/terms">Terms</Link>
      <Link href="/contact">Contact</Link>
    </nav>
  );
}
