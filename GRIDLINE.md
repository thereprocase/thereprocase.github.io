# Gridline across the project network

The public project directory and the project sites use the user-supplied
**Gridline Design System.zip** (9 September 2026).

| Site | Published files | Content |
| --- | --- | --- |
| thereprocase.github.io | `docs/`, exported from the React app | Directory, 7 project landings, Fillaprint, TPU feet and spool rack sites, 404 |
| peg | `docs/` | Current CAD, drawings, host envelope and evidence |
| claude-statusline | `docs/` | 28 actual theme renders, setup and rate-limit log |
| bambu-bridge | `docs/` | Dashboard, API, Home Assistant setup and LAN compatibility |

## Design source

`public/gridline/` is the shared source. `gridline.css` implements the supplied
palette, IBM Plex type, square panes, visible menus, ruled registers and status
bars. `legacy.css` adapts the existing technical pages without replacing their
viewer controls, media or scientific color scales. Supplied token files and
logo SVGs are retained in this directory.

The main directory uses System Gray for structure, white for content, Active
Blue for pane titles and selection, and amber for prototype limitations. CAD
renders retain their original colors and captions.

Copy the entire shared directory to each project's published `gridline/`
directory when changing the common design. Local copies keep the guides
usable independently and avoid coupling project deployments to the root site.
IBM Plex loads from the supplied Google Fonts stylesheet; system and monospace
fallbacks work offline.

## Continuing publication

The site source and generated `docs/` export must be committed together.
Keep the existing canonical routes, downloadable files and viewer hooks. Follow the README build workflow and explicitly request a
GitHub Pages build when a push does not trigger one.

## Verification for this port

- Main-site production build, static export, TypeScript and lint.
- All published HTML routes and cross-site local file/anchor links.
- Preservation of the existing viewer and CFD IDs, scripts and media.
- CFD adapter behavior on original report templates and repeated calls.
- Installation button state changes without reliance on a global event.
- Live Pages deployment commits and served HTML/CSS after publishing.

## Responsive layout and interaction update

The layout is verified from 280 CSS pixels through 3840 pixels. Phone layouts
stack their panes, tablets use compact arrangements, and wide monitors gain
additional columns. Content padding scales within bounds; technical prose
keeps a readable line length while CAD and flow views can expand. Tables,
terminal previews and long contents menus scroll inside their own regions.

Project Groups stays in view while the desktop page scrolls. Below 900 pixels
it becomes a sticky expandable bar. Selecting a category closes that menu and
places the heading below it. Navigation and primary controls have larger touch
areas on phone layouts.

Underlined blue text identifies inline links. Outlined actions and persistent
Open markers identify clickable rows and images. Static title strips, gray
structure, white content, cyan flow sections and amber prototype notes have
separate roles. The numbered decorative workflow strips were removed; the
featured projects offer useful descriptions and working project/setup links.

Browser checks covered all 39 unique routes and viewer modes at 15 widths:
280, 320, 360, 390, 480, 600, 768, 900, 1024, 1280, 1440, 1760, 1920, 2560
and 3840 pixels. All 585 layout checks passed with no page overflow or
JavaScript errors. Desktop sticky navigation, phone menu expansion, category
selection and menu closure passed. Screenshots were inspected at phone,
tablet, desktop and 4K sizes. Movie files were excluded from these layout
checks; their existing scientific content and playback files are unchanged.

## Project identities and dedicated sites

Each listed project has a site linked directly from the directory. Peg,
Claude Code status line and Bambu Bridge publish from their own repositories;
Fillaprint, the TPU feet and the spool rack are served from this repository.
`themes.css` assigns a project field and border through `data-project`: Peg
uses a light engineering sheet and Statusline a terminal gallery. Blue
underlined links and outlined controls retain their meaning throughout.

`project.css` supplies the static project sites. Their contents rail follows
desktop scrolling and becomes an expandable sticky menu below 760 pixels.
Wide screens arrange complementary sections side by side. Tables and terminal
previews scroll locally, preserving readable text on very small screens.

The Statusline gallery renders actual theme functions at 42% and 85% sample context;
`scripts/build-site-previews.py` in that repository records source hashes and
does not consult an installed account or transcript data.

The project-site expansion passed 264 browser layout checks over 44 routes at
280, 390, 768, 1280, 1920 and 3840 pixels, with no page overflow or JavaScript
errors. Thirty follow-up checks covered the final phone dimension strip,
desktop menu visibility and terminal line spacing. All five formation choices,
28 rendered theme previews, both Trio setup modes, HomeKit filter states,
clipboard copying and the five responsive contents rails passed. Static checks
covered 58 HTML files and 712 local URLs; 21 existing technical pages retained
their IDs, media and scripts. The production build, export, types and lint passed.

Bambu Bridge adds an eleventh Gridline site and a Home automation entry. Its
green and lime theme uses the shared responsive panes and sticky contents rail.
The 9 September release passed static markup, link and packaging checks; a new
Bambu viewport sweep and live printer acceptance were not performed.

## 25 September 2026: private projects removed

Thirteen projects whose repositories became private were removed from the
directory, together with their landing pages, renders, the flow-video section
and their `themes.css`/`project.css` rules. GitHub Pages was re-enabled
for Peg, Claude Code status line and Bambu Bridge. The verification records
above describe the network as it was when each check ran.
