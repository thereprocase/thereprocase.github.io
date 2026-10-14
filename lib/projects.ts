export type Project = {
  slug: string; name: string; category: string; summary: string; description: string;
  status: string; highlights: string[]; links: { label: string; href: string }[];
  sourceHref?: string; sitePath?: string; image?: { src: string; alt: string }; spotlight?: boolean; fork?: boolean;
  details?: string[]; gallery?: { src: string; alt: string; caption: string; width: number; height: number }[];
};

const allCategories = [
  { id: 'agent-collaboration', name: 'Agent collaboration', description: 'Tools for coordinating and reviewing coding-agent sessions.' },
  { id: 'hardware', name: 'Hardware & mechanisms', description: 'Printable parts with CAD, analysis and downloads.' },
  { id: 'cad-tools', name: 'Fonts & CAD tools', description: 'Typefaces and tools for 3D-print design.' },
  { id: 'developer-tools', name: 'Developer tools', description: 'Terminal utilities for Claude Code.' },
  { id: 'home-automation', name: 'Home automation', description: 'Local integrations for 3D printers and home devices.' },
  { id: 'self-hosted-models', name: 'Self-hosted models', description: 'Guides and tooling for serving open-weight models on local hardware.' },
  { id: 'upstream-work', name: 'Forks & upstream work', description: 'Separate working copies of open-source projects. Original projects are credited on each page.' },
];

export const projects: Project[] = [
  {
    slug: 'thermal-field', name: 'Thermal Field', category: 'hardware',
    summary: 'An independent open-source Android thermal viewer with lossless radiometry and a Gridline interface.',
    description: 'A native arm64 Android app for the USB 0bda:5830 thermal device used by the P2 Pro. Capture runs through UsbManager, libusb and libuvc; the app renders the original radiometric plane with its own GPU palettes. No proprietary camera SDK is included.',
    status: '0.1.3-rc1 · experimental release candidate; physical lifecycle/baseline/bath gates remain open',
    sourceHref: 'https://github.com/thereprocase/thermal-cam-droid',
    image: { src: '/thermal-field/synthetic-measurements.png', alt: 'Original synthetic enclosure export with spots, box statistics, line, delta and isotherm; temperatures are illustrative' },
    highlights: ['Image-first Gridline workspace, locked/automatic span, palettes and sensor-driven full-screen rotation.', 'Sensor-coordinate spots, boxes, line profiles, point delta and inclusive isotherms.', 'Integrated 8–14 µm Planck graybody correction with explicit model assumptions.', 'Annotated PNG, original lossless 16-bit plane and JSON sidecar; Android sharing.', 'Saved-capture gallery and reanalysis preserve original samples, acquisition time and available device context.'],
    details: ['The images shown here are actual app renders of an original synthetic scene. They are labeled synthetic and do not establish camera accuracy.', 'Independent numerical/export checks preserved every raw sample and matched ROI statistics within 0.001 °C. Pixel live-view runs reached approximately 25 fps under the recorded conditions; physical temperature qualification remains a separate acceptance gate.', 'App code is MIT. libusb is a separate LGPL shared library with its source/build materials supplied; libuvc and bundled fonts retain their own licenses. Vendor logos and product images are not included.'],
    links: [{ label: 'Download arm64 APK · 0.1.3-rc1', href: 'https://github.com/thereprocase/thermal-cam-droid/releases/download/v0.1.3-rc1/ThermalField-0.1.3-rc1-arm64-v8a.apk' }, { label: 'Validation and remaining gates', href: 'https://github.com/thereprocase/thermal-cam-droid/blob/main/docs/VALIDATION.md' }, { label: 'Work tracker', href: 'https://github.com/thereprocase/thermal-cam-droid/issues/1' }],
    gallery: [{ src: '/thermal-field/fullscreen-demo.png', alt: 'Thermal Field full-screen mode on an original synthetic scene', caption: 'Earlier full-screen UI screenshot with original synthetic data. The 0.1.3-rc1 candidate has a refreshed layout and command feedback; this image does not qualify camera accuracy.', width: 960, height: 2142 }, { src: '/thermal-field/synthetic-measurements.png', alt: 'Radiometric measurement export from the synthetic demo', caption: 'Exported synthetic scene with frozen geometry, correction inputs, a palette legend, delta and an isotherm count. Values are test data.', width: 768, height: 1468 }],
  },
  {
    slug: '5680-dock', name: 'Precision 5680 desk dock', category: 'hardware',
    summary: 'D9 P5: a printable laptop cradle with ducted cooling and an adjustable USB-C plug positioner.',
    description: 'The current D9 P5 CAD uses bonded plenum shells, standard wire fan guards, removable H contact cassettes and a polar plug positioner. Inspect the assembly and verification records; the earlier P5 print kit is archived test history.',
    status: 'D9 P5 engineering prototype · physical fit, loads and cooling remain to be qualified',
    highlights: ['Interactive assembly viewer with current CAD and source.', 'Bonded scalloped plenum joints and serviceable fans.', 'Adjustable plug reach with a face clamp and cam support.'],
    image: { src: '/5680-dock/assets/clamp-pivot/01-assembled-port-1.png', alt: 'Actual D9 P5 desk dock CAD with the plug positioner at the laptop port' },
    links: [{ label: 'Explore D9 P5', href: '/5680-dock/' }, { label: 'Current assembly viewer', href: '/5680-dock/desk-dock-p5.html' }, { label: 'Prototype print history', href: '/5680-dock/prints/' }],
  },
  {
    slug: 'dell-5560-wall-mount', name: 'Laptop wall mount', category: 'hardware',
    summary: 'Minimalist M1 and ducted Rev H: two approaches to mounting and cooling a closed laptop.',
    description: 'Download the models and inspect the assembly, retention and cable-routing guides. The current Rev H D4 update repairs the fan-cover sockets. CFD startup evidence includes methods and limitations alongside the flow videos.',
    status: 'Engineering prototypes · physical fit, retention and cooling qualification remain',
    highlights: ['Minimalist and ducted designs with downloadable CAD.', 'Print orientation, fit allowances, cable routing and assembly details.', 'CFD videos and probe histories with explicit model limitations.'],
    image: { src: '/dell-5560-wall-mount/assets/revh-duct-d4-D4-current-assembly.png', alt: 'Actual Rev H laptop wall mount CAD with the D4 duct socket correction' },
    links: [{ label: 'Explore the designs', href: '/dell-5560-wall-mount/' }, { label: 'Print & assembly guide', href: '/dell-5560-wall-mount/minimalist-guide.html' }, { label: 'CFD startup evidence', href: '/dell-5560-wall-mount/simulation/revh-transient/' }],
  },
  {
    slug: 'fillaprint', name: 'Fillaprint', category: 'cad-tools',
    summary: 'Nominal strokes and minimum clear gaps are both two extrusion widths.',
    description: 'Three TrueType families designed around extrusion width. Try your own lettering, calculate a reference print size, and download proportional, tabular-figure, and monospace fonts.',
    status: 'v0.1.0 beta · SIL Open Font License 1.1 · commercial use welcome',
    highlights: ['A live type tester using the actual font files.', 'Print-size calculator based on extrusion line width.', 'Three downloadable font families with broad Latin coverage.'],
    sourceHref: 'https://github.com/thereprocase/double-bead',
    image: { src: '/fillaprint/images/hero.png', alt: 'Fillaprint letterforms and measurement symbols rendered from the font' },
    links: [{ label: 'Font specimens', href: '/fillaprint/' }, { label: 'Download the fonts', href: '/fillaprint/#downloads' }],
  },
  {
    slug: 'paver-feet', name: 'TPU paver feet', category: 'hardware',
    summary: 'Flat 3-inch square, two-piece TPU supports for isolating a concrete paver from its shelf.',
    description: 'Flat 3-inch square, two-piece TPU supports for isolating a concrete paver from its shelf. Inspect the actual CAD, load and clearance calculations, and modeled force transmission before printing.',
    status: 'C01 engineering prototype · physical load and vibration testing remain',
    highlights: ['Interactive CAD viewer and printable STL / STEP downloads.', 'Load and clearance estimates with explicit material assumptions.', 'Transmission analysis distinguishes modeled forces from audible noise.'],
    sourceHref: 'https://github.com/thereprocase/thereprocase.github.io/tree/main/public/paver-feet',
    image: { src: '/paver-feet/featured.png', alt: 'Actual C01 TPU isolation foot CAD geometry' },
    links: [{ label: 'Explore C01', href: '/paver-feet/' }, { label: 'Load and clearance calculation', href: '/paver-feet/#calculation' }],
  },
  {
    slug: 'p1s-feet', name: 'P1S squash-ball cradles', category: 'hardware',
    summary: 'Two-piece TPU cradles with compliant ribs beneath the P1S squash-ball feet.',
    description: 'Two-piece TPU cradles with compliant ribs beneath the P1S squash-ball feet. Inspect the actual CAD, load and clearance calculations, and modeled force transmission before printing.',
    status: 'P02 engineering prototype · physical load and vibration testing remain',
    highlights: ['Interactive CAD viewer and printable STL / STEP downloads.', 'Load and clearance estimates with explicit material assumptions.', 'Transmission analysis distinguishes modeled forces from audible noise.'],
    sourceHref: 'https://github.com/thereprocase/thereprocase.github.io/tree/main/public/p1s-feet',
    image: { src: '/p1s-feet/p02/print-layout.png', alt: 'Actual P02 TPU isolation foot CAD geometry' },
    links: [{ label: 'Explore P02', href: '/p1s-feet/' }, { label: 'Load and deflection calculation', href: '/p1s-feet/#calculation' }],
  },
  {
    slug: 'spool-wall-rack', name: 'Spool wall rack', category: 'hardware',
    summary: 'A printable two-rail spool rack with an angular reinforced bracket, finished CAD and a full engineering record.',
    description: 'E13 combines an 11 mm angular reinforcement with preserved snap fingers and mirrored 50° chamfers. Explore the geometry, refined three-dimensional stress fields, actual slicer paths and downloadable print geometry.',
    status: 'E13 engineering prototype · physical fit, hot-load and lifetime testing remain',
    highlights: ['STEP with aligned infill helpers, plus an STL fallback.', 'Three global mesh levels and matched E12 stress comparisons.', 'Verified geometry and OrcaSlicer paths, with physical checks clearly identified.'],
    image: { src: '/spool-wall-rack/assets/progress-exterior.png', alt: 'Finished E13 spool rack bracket with two rod seats and a straight tapered reinforcement' },
    links: [{ label: 'Explore E13', href: '/spool-wall-rack/' }, { label: 'CAD downloads & print setup', href: '/spool-wall-rack/#downloads' }],
  },
  {
    slug: 'peg', name: 'Conformal pegboard anchor', category: 'hardware',
    summary: 'A reusable pegboard attachment with a defined movement envelope for the parts you build around it.',
    description: 'The anchor follows the lower curve of standard quarter-inch pegboard holes. Download the functional anchor and a reference volume for attached holders, bins, and brackets. Movement checks are documented separately from physical testing.',
    status: 'Geometry-checked prototype · printed fit and load testing remain',
    highlights: ['Functional STEP geometry for integration into your designs.', 'An allowed host volume to preserve insertion and removal clearance.', 'Movement analysis and explicit print-preparation limitations.'],
    image: { src: 'https://raw.githubusercontent.com/thereprocase/peg/main/visuals/conformal-hero.png', alt: 'Rendered conformal pegboard anchor and its curved bearing surfaces' },
    links: [{ label: 'Explore the conformal anchor', href: '/peg/' }, { label: 'Current CAD downloads', href: '/peg/#downloads' }, { label: 'Host integration & movement envelope', href: '/peg/#interface' }],
  },
  {
    slug: 'trio', name: 'Trio / nth', category: 'agent-collaboration', spotlight: true, sitePath: '/projects/trio/',
    summary: 'Shared channels for Claude Code and Codex sessions: messages, atomic task claims and background delivery.',
    description: 'Trio is an MCP server with two skills. /trio runs channels on one machine over stdio and SQLite; /quartet connects machines to a shared hub over Tailscale. Messages are pushed into Claude Code as channel events and into Codex as tool output, and a web dashboard shows the roster, chat and tasks.',
    status: 'Developer tool · MIT · 8.3.0-beta.4',
    highlights: ['Asynchronous channels with @mentions, #references and atomic task claims.', 'Push delivery for Claude Code (trio claude) and stock Codex (trio codex).', 'A web dashboard, an installer for each client and the nth-doctor diagnostic.'],
    image: { src: '/media/trio/channel-midnight.png', alt: 'Trio dashboard showing a release-prep channel where four agents trade messages with @mentions, #references and task updates' },
    details: [
      'Each session joins a channel with a name and a one-line summary. Messages carry three sigils: @name pings a member, #name references one in the background, and !name always gets through. Members pick a listening mode (all, about or at), so each one wakes for the traffic it needs.',
      'Work goes up as tasks. Claims are atomic, so each task has exactly one owner, and blocked_by links a task to the one it waits on. Claims, completions and unblocks appear inline in the channel.',
      'The web dashboard serves channels to a browser: roster, chat with @-autocomplete, a task board, desktop notifications, dictation and 20 themes. On a hub it serves https on the machine\'s Tailscale name; access control comes from the network, through a Tailscale ACL or host firewall.',
      'nth-doctor checks registration, the database, hub reachability and version drift in one command.',
    ],
    gallery: [
      { src: '/media/trio/channel-sagebrush.png', alt: 'The release-prep channel in the Sagebrush light theme', caption: 'The same channel in the Sagebrush light theme. Screens come from a demo channel with invented members and tasks.', width: 1440, height: 900 },
      { src: '/media/trio/tasks-midnight.png', alt: 'Task board listing open tasks with counts for claimed, blocked and done', caption: 'The task board across every channel, with open, claimed, blocked and done counts.', width: 1440, height: 900 },
      { src: '/media/trio/channel-mobile.png', alt: 'The release-prep channel on a phone-sized screen in the Midnight theme', caption: 'The dashboard on a phone, in the Midnight theme.', width: 780, height: 1688 },
    ],
    links: [{ label: 'Quick start', href: 'https://github.com/thereprocase/trio#native-quick-start' }, { label: 'Hub setup', href: 'https://github.com/thereprocase/trio#hub-machine-hosts-the-database--serves-spokes' }],
  },
  {
    slug: 'lord-of-the-code', name: 'Lord of the Code', category: 'agent-collaboration', spotlight: true, sitePath: '/projects/lord-of-the-code/',
    summary: 'A Claude Code skill that runs code reviews with named reviewer agents, each on a set model tier.',
    description: 'Nine Middle-earth characters each cover one area: correctness, architecture, user experience, security, performance, builds, tests, adversarial bug hunting and style. Deploy them individually or as formations, or use Scribe-Merge to take a branch from review through fixes to a pull request.',
    status: 'Claude Code skill · MIT',
    highlights: ['Nine agent definitions across the Opus, Sonnet and Haiku tiers.', 'Four review formations plus the Scribe-Merge review, fix and pull-request workflow.', 'An install script that adds the skill, the agents and the /lotc shorthand.'],
    image: { src: '/media/lord-of-the-code/lotc-running.png', alt: 'Claude Code running /lotc three-seers with Sauron, Gandalf and Frodo launched as parallel review agents on ratelimit.py' },
    details: [
      '/lotc with no arguments asks an Ent to read the code and recommend reviewers. A formation name runs a set team: the Three Seers for correctness, architecture and user experience; the Horde for waves of adversarial bug hunting until three come back clean; the Council of Elrond for design review before implementation; and the War Council for a full pre-release audit.',
      'Reviewers run as parallel subagents, each on its own model tier: Opus for Sauron, Gandalf and Frodo, Sonnet for the specialists, and Haiku for Gollum and the Uruk-Hai swarm. Each reviewer tests its claims where it can and reports findings with file and line references.',
      'The main session merges the reports into one list sorted by severity, removes duplicates, labels each finding verified or likely, and lists where the reviewers disagreed. Scribe-Merge carries that report through fixes to a pull request.',
    ],
    gallery: [
      { src: '/media/lord-of-the-code/lotc-reporting.png', alt: 'Gandalf and Frodo reporting their findings back to the main Claude Code session', caption: 'Reviewers report back as they finish, and the session summarizes each report. This is a real run against a 34-line demo file with planted bugs.', width: 1320, height: 754 },
      { src: '/media/lord-of-the-code/lotc-report.png', alt: 'The merged Three Seers report: three critical issues, six warnings and three notes with fixes', caption: 'The merged report: 3 critical issues, 6 warnings and 3 notes, each with a fix, followed by where the reviewers disagreed.', width: 1320, height: 1485 },
    ],
    links: [{ label: 'Install & usage', href: 'https://github.com/thereprocase/lord-of-the-code#installation' }, { label: 'Review formations', href: 'https://github.com/thereprocase/lord-of-the-code#council-formations' }],
  },
  {
    slug: 'claude-statusline', name: 'Claude Code status line', category: 'developer-tools',
    summary: 'Context, rate limits, and workspace information in a compact, themeable terminal status line.',
    description: 'Keep useful session details visible while you work. Choose from fourteen themes and monitor context and rate limits.',
    status: 'Terminal utility · Bash required',
    highlights: ['Fourteen themes, from monochrome to retro terminals.', 'Context and rate-limit indicators alongside workspace details.', 'Install, theme-switching, and uninstall instructions.'],
    image: { src: 'https://raw.githubusercontent.com/thereprocase/claude-statusline/main/images/statusline-clean.svg', alt: 'Claude Code status line showing session and context indicators' },
    links: [{ label: 'Explore the fourteen themes', href: '/claude-statusline/' }, { label: 'Install & configure', href: '/claude-statusline/#install' }],
  },
  {
    slug: 'bambu-bridge', name: 'Bambu Bridge', category: 'home-automation',
    summary: 'A local P1S printer bridge with a browser dashboard, 3D print-progress viewer, and Home Assistant integration.',
    description: 'Connect to your own printer over the LAN with its access code. The bridge shares MQTT, file-transfer, and camera connections among browser and API clients. The AGPL source release includes installation instructions, upstream notices, and firmware compatibility limits.',
    status: 'AGPL source release · mock-tested; current firmware acceptance remains',
    highlights: ['Browser dashboard and 3D print-progress viewer.', 'HTTP and WebSocket API with Home Assistant integration and add-on source.', 'LAN and Developer Mode requirements, source access, and validation records.'],
    links: [{ label: 'Explore Bambu Bridge', href: '/bambu-bridge/' }, { label: 'Install & configure', href: '/bambu-bridge/#setup' }, { label: 'LAN compatibility & access', href: 'https://github.com/thereprocase/bambu-bridge/blob/main/docs/LAN-COMPATIBILITY.md' }],
  },
  {
    slug: 'deepseek-spark', name: 'DeepSeek V4.1 Flash on DGX Spark', category: 'self-hosted-models', sitePath: '/deepseek-spark/',
    summary: 'Serving DeepSeek V4.1 Flash from DGX Spark-class machines to Open WebUI through LiteLLM, with measurements of its long planning loops.',
    description: 'A field guide to the stack, a reproducible way to measure the model\'s commitment-deferral loop, which settings change it, and a LiteLLM hook that restores earlier reasoning between tool calls. Recommendations are grouped as must, should, consider and avoid.',
    status: 'Field guide · October 2026 · one deployment, small samples',
    highlights: ['Replay and one-token exit-probe measurements with charts and tables.', 'Recommendations grouped as must, should, consider and avoid.', 'The loopguard LiteLLM callback, its tests and the measurement scripts.'],
    sourceHref: 'https://github.com/thereprocase/thereprocase.github.io/tree/main/public/deepseek-spark',
    image: { src: '/deepseek-spark/assets/interventions.png', alt: 'Bar charts comparing how often each setting drafted code inside the thinking and how often it started the tool call' },
    links: [{ label: 'Read the guide', href: '/deepseek-spark/' }, { label: 'Recommendations', href: '/deepseek-spark/#recommendations' }, { label: 'Hook and tools', href: '/deepseek-spark/#files' }],
  },
];

// Groups with no public project are hidden instead of rendering an empty register.
export const categories = allCategories.filter(category => projects.some(project => project.category === category.id));

export const featuredProjects = projects.filter(project => !project.fork);
export const sourceUrl = (project: Project) => project.sourceHref ?? `https://github.com/thereprocase/${project.slug}`;
// sitePath points at the index's own generated page for projects without a Pages site of their own.
export const projectUrl = (project: Project) => project.sitePath ?? (project.fork ? `/projects/${project.slug}/` : `/${project.slug}/`);
