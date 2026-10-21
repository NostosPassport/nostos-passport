import Image from "next/image";
import Link from "next/link";

import { CategoryStampSvg } from "./c/[token]/CategoryStampSvg";
import styles from "./LandingPage.module.css";

const STAMPS = [
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
  {
    name: "Pasta Club",
    locality: "Rome",
    visitedAt: "2026-06-22T20:10:00.000Z",
    timeZone: "Europe/Rome",
    artwork: { version: "category-ink/1" as const, kind: "restaurant" as const, cuisine: "italian", label: "ITALIAN", color: "#5A3A2B", icon: "pasta" as const },
  },
  {
    name: "Café Bleu",
    locality: "Lyon",
    visitedAt: "2026-08-12T12:15:00.000Z",
    timeZone: "Europe/Paris",
    artwork: { version: "category-ink/1" as const, kind: "restaurant" as const, cuisine: "french", label: "FRENCH", color: "#29506A", icon: "croissant" as const },
  },
  {
    name: "After Hours",
    locality: "London",
    visitedAt: "2026-09-14T23:40:00.000Z",
    timeZone: "Europe/London",
    artwork: { version: "category-ink/1" as const, kind: "bar" as const, cuisine: "bar", label: "BAR · CLUB", color: "#613248", icon: "glass" as const },
  },
];

const COLLECTIONS = [
  { index: "01", title: "Italy Trip", copy: "Every trattoria, aperitivo, and place you want to remember from one trip." },
  { index: "02", title: "Favorite Brunch Spots", copy: "The places you keep returning to when someone asks where to go Sunday morning." },
  { index: "03", title: "Date Nights", copy: "A personal list built from nights you actually had, not places you saved and forgot." },
  { index: "04", title: "Best Cocktail Bars", copy: "Your own shortlist, stamped one visit at a time." },
];

function Logo({ large = false }: { large?: boolean }) {
  return (
    <span className={`${styles.logo} ${large ? styles.logoLarge : ""}`} aria-label="Nostos">
      <Image src="/nostos-logo.png" width={large ? 44 : 32} height={large ? 44 : 32} className={styles.logoMark} alt="" aria-hidden="true" />
      <span className={styles.logoWord}>Nostos</span>
    </span>
  );
}

function Stamp({ index, className = "" }: { index: number; className?: string }) {
  const stamp = STAMPS[index]!;
  return (
    <div className={`${styles.stamp} ${className}`}>
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

function ProductStage() {
  return (
    <div className={styles.productStage} aria-label="Nostos product preview">
      <div className={styles.stageHalo} />
      <div className={styles.phone}>
        <div className={styles.phoneHardware}>
          <span className={styles.dynamicIsland} />
        </div>
        <div className={styles.phoneScreen}>
          <div className={styles.phoneHeader}>
            <span className={styles.phoneEyebrow}>MASTER PASSPORT</span>
            <span className={styles.phoneAction}>•••</span>
          </div>
          <div className={styles.phoneTitleRow}>
            <div>
              <strong>Passport</strong>
              <span>Places worth remembering.</span>
            </div>
            <span className={styles.galleryButton}>Gallery</span>
          </div>
          <div className={styles.passportPaper}>
            <span className={styles.passportLabel}>PAGE 08</span>
            <Stamp index={0} className={styles.phoneStampOne} />
            <Stamp index={1} className={styles.phoneStampTwo} />
            <Stamp index={2} className={styles.phoneStampThree} />
          </div>
          <div className={styles.phoneTabs} aria-hidden="true">
            <span className={styles.activeTab}>Passport</span>
            <span>Map</span>
            <span>Stamp</span>
            <span>Profile</span>
          </div>
        </div>
      </div>

      <div className={`${styles.floatingCard} ${styles.galleryFloat}`}>
        <span className={styles.floatKicker}>GALLERY</span>
        <strong>All your stamps,<br />one scroll.</strong>
        <div className={styles.miniStampRow}>
          <Stamp index={3} />
          <Stamp index={5} />
        </div>
      </div>

      <div className={`${styles.floatingCard} ${styles.collectionFloat}`}>
        <span className={styles.floatKicker}>COLLECTION</span>
        <strong>Italy Trip</strong>
        <span className={styles.floatMeta}>A smaller story from your passport</span>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className={styles.site}>
      <header className={styles.nav}>
        <Link href="/" className={styles.brandLink}><Logo /></Link>
        <nav className={styles.navLinks} aria-label="Main navigation">
          <a href="#product">How it works</a>
          <a href="#collections">Collections</a>
          <a href="#privacy">Privacy</a>
        </nav>
        <span className={styles.platformPill}>Made for iPhone</span>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>A passport for the places you actually go</p>
          <h1>Your life,<br /><em>in places.</em></h1>
          <p className={styles.heroBody}>
            Nostos turns restaurants, bars, trips, and everyday favorites into a visual record of where you have been. Every visit becomes a stamp. Over time, those stamps become your passport.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primaryCta} href="#product">See how it works</a>
            <a className={styles.textCta} href="#collections">Ways to use Nostos <span>↘</span></a>
          </div>
          <p className={styles.heroMeta}>Private by default <span>·</span> No public feed <span>·</span> Built around your history</p>
        </div>
        <ProductStage />
      </section>

      <section id="product" className={styles.storySection}>
        <div className={styles.storyLead}>
          <p className={styles.sectionEyebrow}>FROM VISIT TO PASSPORT</p>
          <h2>One dinner is a memory.<br /><em>A year of them is a story.</em></h2>
          <p>
            Nostos is not another list of places you might go. It is a record of the places you actually did.
          </p>
        </div>
        <div className={styles.storySteps}>
          <article>
            <span>01</span>
            <div>
              <h3>Stamp the visit</h3>
              <p>Choose the place, add the memory if you want, and Nostos gives the visit its own stamp.</p>
            </div>
          </article>
          <article>
            <span>02</span>
            <div>
              <h3>Watch the passport grow</h3>
              <p>Flip through the passport, scan everything in the gallery, or see where your history has taken you on the map.</p>
            </div>
          </article>
          <article>
            <span>03</span>
            <div>
              <h3>Pull out the stories inside it</h3>
              <p>Turn any group of visits into a collection for a trip, a ritual, a person, or a list you want to share.</p>
            </div>
          </article>
        </div>
      </section>

      <section className={styles.gallerySection}>
        <div className={styles.galleryIntro}>
          <p className={styles.sectionEyebrow}>STAMP GALLERY</p>
          <h2>Every stamp.<br /><em>One scroll.</em></h2>
          <p>The passport is the keepsake. The gallery is the fast way through it.</p>
          <div className={styles.filterDemo} aria-label="Gallery filter examples">
            <span className={styles.filterActive}>All</span>
            <span>Restaurants</span>
            <span>Bars</span>
          </div>
        </div>
        <div className={styles.galleryWindow}>
          <div className={styles.galleryTop}>
            <span>STAMP GALLERY</span>
            <span>NEWEST FIRST</span>
          </div>
          <div className={styles.galleryGrid}>
            {STAMPS.map((stamp, index) => (
              <div className={styles.galleryItem} key={`${stamp.name}-${index}`}>
                <Stamp index={index} />
                <span>{stamp.locality}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="collections" className={styles.collectionsSection}>
        <div className={styles.collectionsHeader}>
          <p className={styles.sectionEyebrow}>COLLECTIONS</p>
          <h2>A trip. A ritual.<br /><em>A list you actually lived.</em></h2>
          <p>Make smaller stories from your master passport, then keep them private or share a collection when you want to.</p>
        </div>
        <div className={styles.collectionGrid}>
          {COLLECTIONS.map((collection) => (
            <article className={styles.collectionCard} key={collection.title}>
              <span className={styles.collectionIndex}>{collection.index}</span>
              <div>
                <h3>{collection.title}</h3>
                <p>{collection.copy}</p>
              </div>
              <span className={styles.collectionArrow}>↗</span>
            </article>
          ))}
        </div>
      </section>

      <section id="privacy" className={styles.privacySection}>
        <div className={styles.privacyInner}>
          <div className={styles.privacyCopy}>
            <p className={styles.privacyEyebrow}>PRIVATE BY DEFAULT</p>
            <h2>Your passport<br />stays <em>yours.</em></h2>
            <p>Nostos is built around remembering, not performing. There is no follower count, no likes, and no public activity feed.</p>
          </div>
          <div className={styles.privacyFacts}>
            <div><span>01</span><strong>Your master passport cannot be shared.</strong></div>
            <div><span>02</span><strong>Collection links are unlisted and revocable.</strong></div>
            <div><span>03</span><strong>Raw verification coordinates are not kept on stamps.</strong></div>
            <div><span>04</span><strong>Location is optional when creating a stamp.</strong></div>
          </div>
        </div>
      </section>

      <section className={styles.finalSection}>
        <Logo large />
        <h2>Go somewhere<br /><em>worth remembering.</em></h2>
        <p>Nostos is a visual record of the places that become part of your life.</p>
        <span className={styles.finalPill}>Passport · Gallery · Map · Collections</span>
      </section>

      <footer className={styles.footer}>
        <Logo />
        <nav className={styles.footerLinks} aria-label="Legal and support">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/support">Support</Link>
          <Link href="/delete-account">Delete Account</Link>
        </nav>
        <span>© {new Date().getFullYear()} Nostos</span>
      </footer>
    </main>
  );
}
