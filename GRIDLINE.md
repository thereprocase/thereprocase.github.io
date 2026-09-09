# Gridline across the project network

The public project directory and all four project sites use the user-supplied
**Gridline Design System.zip** (9 September 2026).

| Site | Published files | Content |
| --- | --- | --- |
| thereprocase.github.io | `docs/`, exported from the React app | Directory, 15 project landings, 404 |
| dell-5560-wall-mount | `docs/` | Models, assembly guides, CFD and checkpoint reports |
| 5680-dock | `docs/` | Current D8 design, CAD viewers, archived studies |
| onshape-reference-align | `docs/` | Downloads and setup guide |
| claude-usage | repository root | Terminal preview and installation |

## Design source

`public/gridline/` is the shared source. `gridline.css` implements the supplied
palette, IBM Plex type, square panes, visible menus, ruled registers and status
bars. `legacy.css` adapts the existing technical pages without replacing their
viewer controls, media or scientific color scales. Supplied token files and
logo SVGs are retained in this directory.

The main directory uses System Gray for structure, white for content, Active
Blue for pane titles and selection, cyan for linked flow records, and amber
for prototype limitations. CAD renders retain their original colors and
captions. Flow videos use the existing published MP4 aliases, with controls
and no autoplay or preloading of the video files.

Copy the entire shared directory to each project's published `gridline/`
directory when changing the common design. Local copies keep the guides
usable independently and avoid coupling project deployments to the root site.
IBM Plex loads from the supplied Google Fonts stylesheet; system and monospace
fallbacks work offline.

## Continuing publication

The Dell CFD publishers call `fusion/cfd/gridline_html.py` before writing a
report. The standard-library adapter also handles the older documents with
omitted optional head/body tags. It preserves script payloads, element IDs,
media sources, video attributes and technical text, adds section links, and
is safe to call repeatedly. Hourly publications therefore retain Gridline.

The site source and generated `docs/` export must be committed together.
Keep the existing canonical routes, downloadable files, viewer hooks and
checkpoint aliases. Follow the README build workflow and explicitly request a
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
