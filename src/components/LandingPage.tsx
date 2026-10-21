import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Code2,
  FileCode2,
  GitBranch,
  Menu,
  Network,
  Play,
  Sparkles,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import "./LandingPage.css";

const demoVideoSource = "/videos/codevista-demo.mp4";
// Replace the file in public/videos or update this constant to change the demo video.

const features = [
  [Network, "See the Big Picture", "Explore a visual representation of your project architecture, from its overall structure down to individual files and modules."],
  [GitBranch, "Understand What Depends on What", "Visualize relationships between supported files and modules to see how each part of a project connects."],
  [Play, "Follow the Flow of Execution", "Use execution-flow insights to follow important paths and understand how components interact."],
  [Sparkles, "Know What a Change Could Affect", "Evaluate potential impact across connected modules before making a refactor, rewrite, or API change."],
  [FileCode2, "Plan Changes Before You Make Them", "Describe a proposed change and use AI-assisted planning to organize the relevant implementation work."],
] as const;

const steps = [
  ["01", "Connect your project", "Start with a supported GitHub repository or upload a ZIP containing your source code."],
  ["02", "Analyze your codebase", "Inspect supported files, imports, and dependencies to build a visual representation."],
  ["03", "Explore and plan", "Navigate architecture, investigate relationships, and evaluate possible changes."],
];

function ArchitecturePreview() {
  return <div className="landing-diagram" aria-label="Illustrative architecture diagram">
    <div className="diagram-bar"><span className="diagram-dot" /><span className="diagram-dot" /><span className="diagram-dot" /><b>codevista / workspace</b><span>Architecture</span></div>
    <svg className="diagram-lines" viewBox="0 0 600 350" preserveAspectRatio="none" aria-hidden="true">
      <path d="M296 74 C296 120 156 112 156 162 M304 74 C304 120 446 112 446 162 M156 204 C156 245 258 230 290 282 M446 204 C446 245 342 230 310 282" />
    </svg>
    <div className="diagram-node root"><Code2 size={18} /><span>CodeVista AI</span><small>src</small></div>
    <div className="diagram-node left"><FileCode2 size={15} /><span>components</span><small>12 files</small></div>
    <div className="diagram-node right"><GitBranch size={15} /><span>analysis</span><small>6 modules</small></div>
    <div className="diagram-node bottom"><Network size={15} /><span>dependency graph</span><small>ready</small></div>
  </div>;
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  // The analysis workspace intentionally uses a locked, full-screen layout.
  // Restore document scrolling while this route is mounted so the landing page
  // remains one continuous page from the hero through the footer.
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflowX = document.body.style.overflowX;

    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "auto";
    document.body.style.overflowX = "hidden";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overflowX = previousBodyOverflowX;
    };
  }, []);

  const closeMenu = () => setMenuOpen(false);
  const navItems = [["Product", "product"], ["Features", "features"], ["How it works", "how-it-works"], ["Demo", "demo"]] as const;

  return <div className="landing-page">
    <header className="landing-nav">
      <a className="landing-brand" href="#top" onClick={closeMenu}><span><Code2 size={19} /></span>CodeVista <em>AI</em></a>
      <button className="landing-menu-button" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
      <nav className={menuOpen ? "landing-links is-open" : "landing-links"} aria-label="Main navigation">
        {navItems.map(([name, id]) => <a key={id} href={`#${id}`} onClick={closeMenu}>{name}</a>)}
        <Link className="landing-workspace-link" to="/workspace" onClick={closeMenu}>Open workspace <ArrowRight size={15} /></Link>
      </nav>
    </header>

    <main id="top">
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow"><span /> CODEBASE INTELLIGENCE, MADE CLEAR</p>
          <h1>See the architecture <i>behind</i> your code.</h1>
          <p className="landing-lede">CodeVista AI turns complex codebases into visual architecture diagrams, dependency maps, execution flows, and actionable change plans—so you can understand your project before you change it.</p>
          <div className="landing-actions"><Link className="landing-button primary" to="/workspace">Explore your codebase <ArrowRight size={17} /></Link><a className="landing-button secondary" href="#demo"><Play size={15} fill="currentColor" /> Watch product demo</a></div>
          <p className="landing-note"><Check size={15} /> From code structure to change impact, all in one workspace.</p>
        </div>
        <ArchitecturePreview />
      </section>

      <section id="features" className="landing-section features-section"><div className="section-heading"><div><p className="landing-eyebrow">CORE CAPABILITIES</p><h2>Clarity at every layer.</h2></div><p>Made for focused exploration—without overstating what static analysis can know.</p></div><div className="feature-grid">{features.map(([Icon, title, text], index) => <article className={index === 0 ? "feature-card feature-card-wide" : "feature-card"} key={title}><span className="feature-icon"><Icon size={20} /></span><h3>{title}</h3><p>{text}</p>{index === 0 && <div className="mini-graph"><i /><i /><i /><b /></div>}</article>)}</div></section>

      <section id="how-it-works" className="landing-section process-section"><p className="landing-eyebrow">THE WORKFLOW</p><h2>From repository to understanding <i>in three steps.</i></h2><div className="process-grid">{steps.map(([number, title, text]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></section>

      <section id="demo" className="landing-section demo-section"><div className="demo-heading"><p className="landing-eyebrow">PRODUCT WALKTHROUGH</p><h2>See CodeVista AI in action.</h2><p>Watch how to explore a repository, understand its architecture, trace dependencies, and plan changes with confidence.</p></div><figure className="video-frame"><video controls preload="metadata" aria-label="CodeVista AI product demo"><source src={demoVideoSource} type="video/mp4" />Your browser does not support HTML5 video.</video></figure><p className="video-caption">A guided walkthrough of the CodeVista AI repository analysis workflow.</p></section>

      <section className="landing-section why-section"><div><p className="landing-eyebrow">BUILT FOR CLARITY</p><h2>Built for developers who want clarity.</h2></div><ul>{["Visual understanding of complex repositories", "Easier dependency tracing across supported files", "Better visibility into potential change impact", "AI-assisted planning for proposed modifications", "A more structured way to explore unfamiliar codebases"].map(item => <li key={item}><Check size={17} />{item}</li>)}</ul></section>

      <section className="landing-cta"><p className="landing-eyebrow">START WITH CONTEXT</p><h2>Make your next code change with more context.</h2><p>Explore your repository, understand its relationships, and plan your next change with CodeVista AI.</p><div className="landing-actions"><Link className="landing-button primary" to="/workspace">Open workspace <ArrowRight size={17} /></Link><a className="landing-button secondary" href="#demo"><Play size={15} fill="currentColor" /> Watch demo</a></div></section>
    </main>
    <footer className="landing-footer"><a className="landing-brand" href="#top"><span><Code2 size={18} /></span>CodeVista <em>AI</em></a><p>Visual context for complex codebases.</p><nav>{navItems.map(([name,id]) => <a key={id} href={`#${id}`}>{name}</a>)}<a href="https://github.com/nanditha1409/CodeVista-AI" target="_blank" rel="noreferrer">GitHub</a></nav><small>© {new Date().getFullYear()} CodeVista AI</small></footer>
  </div>;
}
