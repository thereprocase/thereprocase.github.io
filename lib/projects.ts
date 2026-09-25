export type Project = {
  slug: string; name: string; category: string; summary: string; description: string;
  status: string; highlights: string[]; links: { label: string; href: string }[];
  sourceHref?: string; image?: { src: string; alt: string }; spotlight?: boolean; fork?: boolean;
};

export const categories = [
  { id: 'agent-collaboration', name: 'Agent collaboration', description: 'Coordinate the work. Review what comes back.' },
  { id: 'hardware', name: 'Hardware & mechanisms', description: 'Printable parts, working geometry, and the evidence behind each design.' },
  { id: 'cad-tools', name: 'CAD tools', description: 'Small tools for more precise design work.' },
  { id: 'developer-tools', name: 'Developer tools', description: 'Keep usage and context in view.' },
  { id: 'home-automation', name: 'Home automation', description: 'Make the configuration easier to understand.' },
  { id: 'upstream-work', name: 'Forks & upstream work', description: 'Separate working copies of open-source projects. Original projects are credited on each page.' },
];

export const projects: Project[] = [
  {
    slug: 'brewster-technical', name: 'Brewster Technical', category: 'cad-tools',
    summary: 'Strokes and gaps reach the same minimum printable size together.',
    description: 'Three TrueType families designed around extrusion width. Try your own lettering, calculate a reference print size, and download proportional, tabular-figure, and monospace fonts.',
    status: 'Version 1.201 · SIL Open Font License 1.1 · commercial use welcome',
    highlights: ['A live type tester using the actual font files.', 'Print-size calculator based on extrusion line width.', 'Three downloadable font families with broad Latin coverage.'],
    sourceHref: 'https://github.com/thereprocase/double-bead',
    image: { src: '/brewster-technical/images/hero.png', alt: 'Brewster Technical letterforms and measurement symbols rendered from the font' },
    links: [{ label: 'Explore the typeface', href: '/brewster-technical/' }, { label: 'Download the fonts', href: '/brewster-technical/#downloads' }],
  },
  {
    slug: 'paver-feet', name: 'TPU paver feet', category: 'hardware',
    summary: 'Flat 3-inch square, two-piece TPU supports for isolating a concrete paver from its shelf.',
    description: 'Flat 3-inch square, two-piece TPU supports for isolating a concrete paver from its shelf. Inspect the actual CAD, load and clearance calculations, and modeled force transmission before printing.',
    status: 'C01 engineering prototype · physical load and vibration testing remain',
    highlights: ['Interactive CAD viewer and printable STL / STEP downloads.', 'Load and clearance estimates with explicit material assumptions.', 'Transmission analysis distinguishes modeled forces from audible noise.'],
    sourceHref: 'https://github.com/thereprocase/thereprocase.github.io/tree/main/public/paver-feet',
    image: { src: '/paver-feet/featured.png', alt: 'Actual C01 TPU isolation foot CAD geometry' },
    links: [{ label: 'Explore C01', href: '/paver-feet/' }, { label: 'Model and analysis', href: '/paver-feet/' }],
  },
  {
    slug: 'p1s-feet', name: 'P1S squash-ball cradles', category: 'hardware',
    summary: 'Two-piece TPU cradles with compliant ribs beneath the P1S squash-ball feet.',
    description: 'Two-piece TPU cradles with compliant ribs beneath the P1S squash-ball feet. Inspect the actual CAD, load and clearance calculations, and modeled force transmission before printing.',
    status: 'P02 engineering prototype · physical load and vibration testing remain',
    highlights: ['Interactive CAD viewer and printable STL / STEP downloads.', 'Load and clearance estimates with explicit material assumptions.', 'Transmission analysis distinguishes modeled forces from audible noise.'],
    sourceHref: 'https://github.com/thereprocase/thereprocase.github.io/tree/main/public/p1s-feet',
    image: { src: '/p1s-feet/p02/print-layout.png', alt: 'Actual P02 TPU isolation foot CAD geometry' },
    links: [{ label: 'Explore P02', href: '/p1s-feet/' }, { label: 'Model and analysis', href: '/p1s-feet/' }],
  },
  {
    slug: 'trio', name: 'Trio / nth', category: 'agent-collaboration', spotlight: true,
    summary: 'A shared workspace for coding agents: messages, task claims, and a live view of who is doing what.',
    description: 'Trio connects independent Claude Code sessions through an MCP server. Work locally with Trio, or connect machines through Quartet and Tailscale. Participants communicate asynchronously and claim tasks without duplicating work.',
    status: 'Developer tool · local and cross-machine workflows',
    highlights: ['Asynchronous channels, mentions, and atomic task claims.', 'A web dashboard with participant status and task visibility.', 'Setup instructions and a diagnostic tool for checking the connection.'],
    links: [{ label: 'Open the Trio / nth site', href: '/trio/' }, { label: 'Choose local or cross-machine setup', href: '/trio/#setup' }],
  },
  {
    slug: 'lord-of-the-code', name: 'Lord of the Code', category: 'agent-collaboration', spotlight: true,
    summary: 'A coordinated code-review workflow with specialized reviewers and a review, fix, and merge sequence.',
    description: 'A Claude Code skill that assigns review roles to a cast of Middle-earth characters. Choose a review formation, bring in the right specialists, and carry findings through fixes with the Scribe-Merge workflow.',
    status: 'Claude Code skill · review workflows',
    highlights: ['Specialized reviewer roles and selectable formations.', 'A packaged skill, agent definitions, and an install script.', 'Scribe-Merge connects review findings with the follow-up work.'],
    links: [{ label: 'Open Lord of the Code', href: '/lord-of-the-code/' }, { label: 'Choose a review formation', href: '/lord-of-the-code/#formations' }],
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
    image: { src: '/dell-5560-wall-mount/assets/minimalist-with-envelopes.png', alt: 'Minimalist laptop wall mount CAD with laptop and fan envelopes' },
    slug: 'dell-5560-wall-mount', name: 'Laptop wall mount', category: 'hardware',
    summary: 'Minimalist M1 and ducted Rev H: two approaches to mounting and cooling a closed laptop.',
    description: 'Follow the design from fit and print orientation through retention details and airflow studies. Download the models, inspect assembly guides, and watch the cumulative Rev H flow videos as new checkpoints are published.',
    status: 'Engineering prototypes · physical qualification remains',
    highlights: ['Independent minimalist and ducted designs with downloadable CAD.', 'Print orientation, fit allowances, and assembly details.', 'Moving-particle CFD videos with methods and limitations alongside the results.'],
    links: [{ label: 'Explore the designs', href: '/dell-5560-wall-mount/' }, { label: 'Print & assembly guide', href: '/dell-5560-wall-mount/minimalist-guide.html' }, { label: 'Latest particle-flow video', href: '/dell-5560-wall-mount/simulation/revh-transient/sequence/latest-tracers.mp4' }],
  },
  {
    slug: '5680-dock', name: 'Precision 5680 desk dock', category: 'hardware',
    summary: 'D9 P2: cradles, plenums, fan guards and braces with printed pins and locking keys. No added metal hardware.',
    description: 'D9 P2 is the current Precision 5680 dock prototype. Fifty printed parts have completed CAD and nominal enclosure checks; seven assembly plates plus a fastener fit plate passed Orca verification. Start with the printed-fastener fit plate and the V4 laptop-contact coupons, then use the complete P2 print kit. The plug mechanism is outside this revision.',
    status: 'D9 P2 print kit ready · physical fit, loads and cooling remain untested',
    highlights: ['Two split plenums with full-height R2 cradles and bolted frame ties.', 'Fan guards with integral standoffs; accessible internal supports.', 'Six native Orca plates, matching G-code, STEP/STL, source and assembly instructions.'],
    image: { src: '/5680-dock/printables/d9-p2/D9-P2-assembly.png', alt: 'D9 P2 CAD assembly with paired cradles, split plenums, fan guards and frame ties' },
    links: [{ label: 'Explore D9 P2', href: '/5680-dock/' }, { label: 'Fastener fit plate', href: '/5680-dock/printables/d9-p2/OPEN-ME.3mf' }, { label: 'Download D9 print kit', href: '/5680-dock/printables/d9-p2/Precision_5680_D9_P2_Print_Kit.zip' }, { label: 'Orca plates & instructions', href: '/5680-dock/handoff-2026-09-17.html#d9-printables' }],
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
    image: { src: '/onshape-reference-align/images/workspace-preview.png', alt: 'Reference Align workspace using a sample image and local test account' },
    slug: 'onshape-reference-align', name: 'Reference Align for Onshape', category: 'cad-tools',
    summary: 'Scale and rotate reference images using distances and directions you already know.',
    description: 'A local companion app gives you a precise image picker and sends the resulting calibration to Onshape. Separate scale and rotation pairs help when the best known distance and direction are in different parts of an image.',
    status: 'Desktop downloads · Windows, macOS, and Linux',
    highlights: ['Zoom, pan, a loupe, and subpixel point selection.', 'Separate pixel pairs for scale and rotation.', 'Packaged launchers, setup instructions, and backups before feature updates.'],
    links: [{ label: 'Preview & setup', href: '/onshape-reference-align/' }, { label: 'Get the app', href: 'https://github.com/thereprocase/onshape-reference-align/releases/latest' }, { label: 'Setup & calibration guide', href: 'https://github.com/thereprocase/onshape-reference-align#readme' }],
  },
  {
    slug: 'claude-statusline', name: 'Claude Code status line', category: 'developer-tools',
    summary: 'Context, rate limits, and workspace information in a compact, themeable terminal status line.',
    description: 'Keep useful session details visible while you work. Choose from fourteen themes, monitor context and rate limits, and optionally feed threshold events into the companion usage heatmap.',
    status: 'Terminal utility · Bash required',
    highlights: ['Fourteen themes, from monochrome to retro terminals.', 'Context and rate-limit indicators alongside workspace details.', 'Install, theme-switching, and uninstall instructions.'],
    image: { src: 'https://raw.githubusercontent.com/thereprocase/claude-statusline/main/images/statusline-clean.svg', alt: 'Claude Code status line showing session and context indicators' },
    links: [{ label: 'Explore the fourteen themes', href: '/claude-statusline/' }, { label: 'Install & configure', href: '/claude-statusline/#install' }, { label: 'Companion usage heatmap', href: '/claude-usage/' }],
  },
  {
    slug: 'claude-usage', name: 'Claude usage', category: 'developer-tools',
    summary: 'A 90-day usage heatmap from local Claude Code transcripts, with project and model breakdowns.',
    description: 'See when and where you use Claude Code without API calls or a separate account. Read local transcript data and optionally include rate-limit threshold markers recorded by the companion status line.',
    status: 'Local utility · Python standard library',
    highlights: ['Daily heatmap, session counts, and token summaries.', 'Project and model breakdowns from local data.', 'Launch instructions for Windows, macOS, and Linux.'],
    links: [{ label: 'Preview & installation', href: '/claude-usage/' }, { label: 'Companion status line', href: '/claude-statusline/' }],
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
    slug: 'homekit-preview', name: 'HomeKit Preview', category: 'home-automation',
    summary: 'See which Home Assistant entities a HomeKit Bridge exposes before you pair or change it.',
    description: 'A Home Assistant integration shows bridge configuration in a room, device, and entity view. Preview the current filter, browse candidates, and apply changes to the selected HomeKit Bridge from one sidebar.',
    status: 'Home Assistant custom integration · early development',
    highlights: ['Bridge selection, entity previews, and room/device filters.', 'Visible warnings for broad domain inclusion.', 'A filter builder that can update and reload the selected bridge.'],
    links: [{ label: 'Open HomeKit Preview', href: '/homekit-preview/' }, { label: 'Try the filter example', href: '/homekit-preview/#example' }, { label: 'Install with HACS', href: '/homekit-preview/#install' }],
  },
  ...[
    ['codex', 'Codex CLI', 'openai/codex', 'Working fork for coding-agent experiments, including the monitor workflow described in the repository.'],
    ['OrcaSlicer', 'OrcaSlicer', 'OrcaSlicer/OrcaSlicer', 'Working branches for slicer and print-bed arrangement experiments.'],
    ['calibre', 'Calibre', 'kovidgoyal/calibre', 'A working copy of the open-source ebook manager.'],
    ['beads', 'Beads', 'gastownhall/beads', 'A working copy of the agent task and memory project.'],
    ['gastown', 'Gas Town', 'gastownhall/gastown', 'A working copy of the multi-agent workspace manager.'],
    ['PocketBook-SDK', 'PocketBook SDK', 'Sean-on-Git/PocketBook-SDK', 'A working copy of the PocketBook reader development resources.'],
  ].map(([slug, name, upstream, summary]) => ({
    slug, name, category: 'upstream-work', summary, description: summary,
    status: 'Public fork · upstream project credited separately', fork: true,
    highlights: ['Inspect this fork’s branches and commit history for local work.', 'Build instructions and licenses remain with the source project.'],
    links: [{ label: 'Upstream project', href: `https://github.com/${upstream}` }],
  })),
];

export const featuredProjects = projects.filter(project => !project.fork);
export const sourceUrl = (project: Project) => project.sourceHref ?? `https://github.com/thereprocase/${project.slug}`;
export const projectUrl = (project: Project) => project.fork ? `/projects/${project.slug}/` : `/${project.slug}/`;
