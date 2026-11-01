import Link from "next/link";
import { projects } from "@/lib/demo-data";

const trails = [
  {
    topic: "Developer tools",
    title: "Tools that smooth the work",
    description: "Small utilities and workflow ideas built to make everyday development feel lighter.",
    mark: "~/",
    tone: "blue",
  },
  {
    topic: "Open source",
    title: "Open work, shared early",
    description: "Browse sample projects that invite questions, feedback, and the next useful contribution.",
    mark: "↗",
    tone: "violet",
  },
  {
    topic: "Local-first",
    title: "Software that stays yours",
    description: "Explore privacy-minded ideas that put thoughtful defaults and user control first.",
    mark: "◎",
    tone: "green",
  },
  {
    topic: "Design systems",
    title: "Interfaces with intention",
    description: "Find component kits, visual experiments, and the craft behind the interface.",
    mark: "▦",
    tone: "amber",
  },
] as const;

export function LandingDiscovery() {
  return (
    <section className="discovery" id="trails" aria-labelledby="discovery-title">
      <div className="discovery-inner">
        <header className="discovery-header">
          <p className="discovery-kicker"><span>(04)</span> Pick a trail</p>
          <h2 id="discovery-title">Follow your curiosity.</h2>
          <p>Start with a topic, open a project story, and see what you might learn or build next.</p>
        </header>

        <div className="trail-grid">
          {trails.map((trail, index) => {
            const count = projects.filter((project) =>
              project.tags.some((tag) => tag.toLowerCase() === trail.topic.toLowerCase()),
            ).length;

            return (
              <Link
                className={`trail-card trail-card-${trail.tone}`}
                href={`/explore?q=${encodeURIComponent(trail.topic)}`}
                key={trail.topic}
              >
                <span className="trail-card-top">
                  <span className="trail-index">0{index + 1} / TOPIC</span>
                  <span className="trail-mark" aria-hidden="true">{trail.mark}</span>
                </span>
                <h3>{trail.title}</h3>
                <p>{trail.description}</p>
                <span className="trail-card-bottom">
                  <span>{count} sample {count === 1 ? "project" : "projects"}</span>
                  <span aria-hidden="true">Explore topic <b>↗</b></span>
                </span>
              </Link>
            );
          })}
        </div>

        <div className="discovery-note">
          <div>
            <p className="discovery-kicker">A good project story</p>
            <h3>Look beyond the screenshot.</h3>
          </div>
          <ol>
            <li><b>01</b><span>What problem started the idea?</span></li>
            <li><b>02</b><span>Which choices shaped the build?</span></li>
            <li><b>03</b><span>What would make the next version better?</span></li>
          </ol>
        </div>

        <div className="discovery-faq" aria-labelledby="discovery-faq-title">
          <h3 id="discovery-faq-title">A few quick answers</h3>
          <details>
            <summary>Can I explore without signing in?</summary>
            <p>Yes. The project preview and its sample stories are open to browse. An account is needed for account-specific actions.</p>
          </details>
          <details>
            <summary>Are the projects and activity on this page live?</summary>
            <p>No. The landing showcase uses illustrative preview projects. It does not represent real member totals or a live community feed.</p>
          </details>
          <details>
            <summary>Where should I go if I have something to share?</summary>
            <p>Open <Link href="/signup">Create account</Link> to begin. Publishing requires a signed-in account and a correctly configured project database.</p>
          </details>
        </div>
      </div>
    </section>
  );
}
