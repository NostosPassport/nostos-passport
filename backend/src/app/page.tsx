import Image from "next/image";
import Link from "next/link";

import { CategoryStampSvg } from "./c/[token]/CategoryStampSvg";
import styles from "./LandingPage.module.css";

const SAMPLE_STAMPS = [
  {
    name: "Trattoria Sostanza",
    locality: "Florence",
    visitedAt: "2026-06-18T19:30:00.000Z",
    timeZone: "Europe/Rome",
    artwork: { version: "category-ink/1" as const, kind: "restaurant" as const, cuisine: "italian", label: "ITALIAN", color: "#143B2B", icon: "pasta" as const },
  },
  {
    name: "Sunday Brunch",
    locality: "Paris",
    visitedAt: "2026-09-20T15:00:00.000Z",
    timeZone: "Europe/Paris",
    artwork: { version: "category-ink/1" as const, kind: "restaurant" as const, cuisine: "french", label: "FRENCH", color: "#385478", icon: "croissant" as const },
  },
  {
    name: "Nightcap",
    locality: "Lisbon",
    visitedAt: "2026-10-03T02:15:00.000Z",
    timeZone: "Europe/Lisbon",
    artwork: { version: "category-ink/1" as const, kind: "bar" as const, cuisine: "bar", label: "BAR · CLUB", color: "#7C1030", icon: "glass" as const },
  },
];

const USE_CASES = [
  "Favorite Brunch Spots",
  "Italy Trip",
  "Best Cocktail Bars",
  "Date Nights",
  "Coffee Shops Worth Returning To",
  "Places I Keep Recommending",
];

function Logo() {
  return (
    <span className={styles.logo} aria-label="Nostos">
      <Image src="/nostos-logo.png" width={32} height={32} className={styles.logoMark} alt="" aria-hidden="true" />
      <span className={styles.logoWord}>Nostos</span>
    </span>
  );
}

function StampCard({ index }: { index: number }) {
  const stamp = SAMPLE_STAMPS[index]!;
  return (
    <div className={`${styles.stampCard} ${styles[`stampCard${index + 1}`]}`}>
      <CategoryStampSvg
        artwork={stamp.artwork}
        name={stamp.name}
        locality={stamp.locality}
        visitedAt={stamp.visitedAt}
        timeZone={stamp.timeZone}
        seed={`landing-${index}`}
      />
    </div>
  );
}

function HeroVisual() {
  return (
    <div className={styles.heroVisual} aria-label="Examples of Nostos stamps">
      <div className={styles.heroGlow} />
      <div className={styles.passportFrame}>
        <div className={styles.passportTopline}>
          <span>NOSTOS PASSPORT</span>
          <span>MASTER</span>
        </div>
        <div className={styles.passportPages}>
          <div className={styles.passportPage}>
            <StampCard index={0} />
            <StampCard index={2} />
          </div>
          <div className={styles.passportPage}>
            <StampCard index={1} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className={styles.site}>
      <div className={styles.navWrap}>
        <nav className={styles.nav} aria-label="Main navigation">
          <Link href="/" className={styles.brandLink}><Logo /></Link>
          <div className={styles.navLinks}>
            <a href="#how-it-works">How it works</a>
            <a href="#collections">Collections</a>
            <a href="#privacy">Privacy</a>
            <span className={styles.navBadge}>Made for iPhone</span>
          </div>
        </nav>
      </div>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>A passport for the places you go</p>
          <h1 className={styles.heroTitle}>Go somewhere. <em>Keep the story.</em></h1>
          <p className={styles.heroBody}>
            Nostos turns restaurants, bars, trips, and everyday favorites into a visual record of where you have actually been. Every visit becomes a stamp, and every stamp becomes part of your passport.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primaryCta} href="#how-it-works">See how it works</a>
            <a className={styles.secondaryCta} href="#collections">Ways to use Nostos</a>
          </div>
          <p className={styles.heroNote}>Passport · Gallery · Map · Collections</p>
        </div>
        <HeroVisual />
      </section>

      <section id="how-it-works" className={styles.section}>
        <div className={styles.sectionIntro}>
          <p className={styles.sectionKicker}>How it works</p>
          <h2 className={styles.sectionTitle}>Your places, rendered into something worth keeping.</h2>
          <p className={styles.sectionLead}>Nostos is built around your own history, not a public feed. Stamp a visit, browse the passport or gallery, and return to it later through collections and the map.</p>
        </div>
        <div className={styles.featureGrid}>
          <article className={styles.featureCard}>
            <span className={styles.featureNumber}>01</span>
            <h3>Stamp the visit.</h3>
            <p>Save a restaurant or bar with the stamp design generated for that kind of place. Add photos, a memory, or a song when you want more context.</p>
          </article>
          <article className={styles.featureCard}>
            <span className={styles.featureNumber}>02</span>
            <h3>Browse it your way.</h3>
            <p>Flip through the passport, scan every stamp in the gallery, filter restaurants and bars, or see your visited places on the map.</p>
          </article>
          <article className={styles.featureCard}>
            <span className={styles.featureNumber}>03</span>
            <h3>Make smaller stories.</h3>
            <p>Turn any group of stamps into a collection for a trip, a type of place, a person, a neighborhood, or whatever else matters to you.</p>
          </article>
        </div>
      </section>

      <section id="collections" className={styles.collectionsSection}>
        <div className={styles.collectionCopy}>
          <p className={styles.sectionKicker}>Collections</p>
          <h2 className={styles.sectionTitle}>A trip. A ritual. A list you actually lived.</h2>
          <p className={styles.sectionLead}>Collections can be as practical or personal as you want. Use them to organize a journey, remember your regular spots, or package the places you keep sending to friends.</p>
        </div>
        <div className={styles.useCases}>
          {USE_CASES.map((label, index) => (
            <div className={styles.useCase} key={label}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{label}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.stampStrip} aria-label="Nostos stamp design examples">
        {SAMPLE_STAMPS.map((stamp, index) => (
          <div className={styles.stripStamp} key={`${stamp.name}-${index}`}>
            <CategoryStampSvg artwork={stamp.artwork} name={stamp.name} locality={stamp.locality} visitedAt={stamp.visitedAt} timeZone={stamp.timeZone} seed={`strip-${index}`} />
          </div>
        ))}
      </section>

      <section id="privacy" className={styles.privacy}>
        <div>
          <p className={styles.sectionKicker}>Private by default</p>
          <h2 className={styles.privacyTitle}>Your master passport stays yours.</h2>
        </div>
        <div className={styles.privacyCopy}>
          <p>Nostos has no follower count, likes, or public activity feed. Your master Passport stays private. When you want to share something, you choose a collection and create a revocable, unlisted read-only link.</p>
          <div className={styles.privacyFacts}>
            <span>Master Passport cannot be shared</span>
            <span>Location is optional for creating a stamp</span>
            <span>Raw verification coordinates are not kept on stamps</span>
            <span>Collection links can be disabled at any time</span>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <Logo />
          <p>A visual record of the places you have actually been.</p>
        </div>
        <nav className={styles.footerLinks} aria-label="Legal and support">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/support">Support</Link>
          <Link href="/delete-account">Delete Account</Link>
        </nav>
        <div className={styles.footerBottom}>
          <span>Designed for iPhone</span>
          <span>© {new Date().getFullYear()} Nostos</span>
        </div>
      </footer>
    </main>
  );
}
