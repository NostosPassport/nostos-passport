import type { CSSProperties } from "react";
import Link from "next/link";

import styles from "./LandingPage.module.css";

const destinations = [
  "New York",
  "Rome",
  "Florence",
  "Paris",
  "London",
  "Tokyo",
  "Chicago",
  "Barcelona",
];

const stampAngle = (angle: string) => ({ "--stamp-angle": angle } as CSSProperties);

function DestinationTicker() {
  const items = [...destinations, ...destinations];
  return (
    <div className={styles.ticker} aria-hidden="true">
      <div className={styles.tickerTrack}>
        {items.map((name, index) => (
          <span key={`${name}-${index}`} className={styles.tickerItem}>{name}</span>
        ))}
      </div>
    </div>
  );
}

function HeroPassport() {
  return (
    <div className={styles.heroVisual} aria-hidden="true">
      <div className={styles.heroOrbit} />
      <div className={styles.heroOrbitTwo} />
      <div className={styles.bookScene}>
        <div className={styles.bookShadow} />
        <div className={styles.book}>
          <div className={styles.page}>
            <div className={styles.pageRule} />
            <div className={styles.guilloche} />
            <div className={`${styles.stamp} ${styles.stampOne}`} style={stampAngle("-7deg")}>
              <span>Morning coffee<span className={styles.stampDate}>Oct · 18</span></span>
            </div>
            <div className={`${styles.stamp} ${styles.stampThree}`} style={stampAngle("5deg")}>
              <span>Sunday walk<span className={styles.stampDate}>Oct · 19</span></span>
            </div>
            <span className={styles.pageNumber}>07</span>
          </div>
          <div className={styles.page}>
            <div className={styles.pageRule} />
            <div className={styles.guilloche} />
            <div className={`${styles.stamp} ${styles.stampTwo}`} style={stampAngle("8deg")}>
              <span>Dinner<span className={styles.stampDate}>Oct · 20</span></span>
            </div>
            <span className={styles.pageNumber}>08</span>
          </div>
          <div className={styles.bookSpine} />
        </div>
        <div className={styles.floatingTicket}>
          Visit memory
          <strong>Rome, Italy</strong>
        </div>
        <div className={styles.floatingPin} />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className={styles.site}>
      <div className={styles.navWrap}>
        <nav className={styles.nav} aria-label="Main navigation">
          <Link href="/" className={styles.wordmark}>Nostos</Link>
          <div className={styles.navLinks}>
            <a href="#how-it-works">How it works</a>
            <a href="#privacy">Privacy</a>
            <span className={styles.navBadge}><span className={styles.navBadgeDot} />Made for iPhone</span>
          </div>
        </nav>
      </div>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>A passport for the places you go</p>
          <h1 className={styles.heroTitle}>Go somewhere. <em>Keep the story.</em></h1>
          <p className={styles.heroBody}>
            Nostos turns the places you actually visit into a personal passport. Stamp the moment, add the memory, and watch the places you have been take shape page by page.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primaryCta} href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a>
            <a className={styles.secondaryCta} href="#privacy">Private by default</a>
            <p className={styles.heroNote}>Passport · Stamp · Map</p>
          </div>
        </div>
        <HeroPassport />
      </section>

      <DestinationTicker />

      <section id="how-it-works" className={styles.sectionWide}>
        <header className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionKicker}>How Nostos works</p>
          </div>
          <div>
            <h2 className={styles.sectionTitle}>Your travels, printed into pages.</h2>
            <p className={styles.sectionLead}>
              Nostos is built around the visit itself. No feed to perform for, no follower count to chase. Just places, memories, and a passport that becomes more yours every time you go somewhere.
            </p>
          </div>
        </header>

        <div className={styles.steps}>
          <article className={styles.step}>
            <div className={styles.stepIndex}><span>01</span><span>Stamp</span></div>
            <div className={styles.stepVisual}>
              <div className={styles.stampDemo} />
            </div>
            <h3 className={styles.stepTitle}>Stamp the visit.</h3>
            <p className={styles.stepBody}>
              Add a place you are at now or a memory from the past year. Include up to six photos, a caption, a song, or keep it simple.
            </p>
          </article>

          <article className={styles.step}>
            <div className={styles.stepIndex}><span>02</span><span>Passport</span></div>
            <div className={styles.stepVisual}>
              <div className={styles.passportMini}><span /><span /></div>
            </div>
            <h3 className={styles.stepTitle}>Build your passport.</h3>
            <p className={styles.stepBody}>
              Visits settle into chronological passport pages, each with its own stamp. When Nostos can confirm a current visit, it adds a verification seal.
            </p>
          </article>

          <article className={styles.step}>
            <div className={styles.stepIndex}><span>03</span><span>Map</span></div>
            <div className={styles.stepVisual}>
              <div className={styles.mapDemo}>
                <span className={styles.mapDemoPin} />
                <span className={styles.mapDemoPinTwo} />
                <span className={styles.mapDemoPinThree} />
              </div>
            </div>
            <h3 className={styles.stepTitle}>See where you have been.</h3>
            <p className={styles.stepBody}>
              Return to the places behind the pages through the map. Your passport remembers places the way you experienced them, not as a recommendation feed.
            </p>
          </article>
        </div>
      </section>

      <section id="privacy" className={styles.privacy}>
        <div className={styles.privacyGrid}>
          <div>
            <p className={styles.sectionKicker}>Private by default</p>
            <h2 className={styles.privacyTitle}>Your passport is yours.</h2>
          </div>
          <div className={styles.privacyCopy}>
            <p className={styles.privacyLead}>
              Nostos is a personal product first. Your master Passport stays private. There are no public profiles, followers, likes, or activity feeds. When you want to share, you can choose a collection and create a revocable, unlisted read-only link.
            </p>
            <div className={styles.privacyFacts}>
              <p className={styles.privacyFact}>Master Passport cannot be shared</p>
              <p className={styles.privacyFact}>Location is optional for creating a stamp</p>
              <p className={styles.privacyFact}>Raw verification coordinates are not kept on stamps</p>
              <p className={styles.privacyFact}>Shared collection links can be disabled at any time</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.quoteSection}>
        <div className={styles.quoteMark}>N</div>
        <h2 className={styles.quote}>A memory app for the places you <em>actually went.</em></h2>
        <p className={styles.quoteSub}>
          Save the dinner you still talk about, the bar you stumbled into, the coffee you kept coming back for, and the ordinary afternoons that made a place feel like yours.
        </p>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div>
            <div className={styles.footerWordmark}>Nostos</div>
            <p className={styles.footerTagline}>A passport for the places you go. Go somewhere, get a stamp.</p>
          </div>
          <nav className={styles.footerLinks} aria-label="Legal and support">
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/support">Support</Link>
            <Link href="/delete-account">Delete Account</Link>
          </nav>
        </div>
        <div className={styles.footerBottom}>
          <span>Designed for iPhone</span>
          <span>© {new Date().getFullYear()} Nostos</span>
        </div>
      </footer>
    </main>
  );
}