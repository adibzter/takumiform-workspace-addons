# TakumiForm — Google Workspace Add-ons

One Google Forms add-on carrying multiple TakumiForm features. The published Marketplace listing is [*TakumiForm — Embed in Website*](https://workspace.google.com/marketplace/app/takumiform_embed_in_website/61166924939), built from `embed/`. The original plan was five listings, one per Marketplace keyword (mirroring Formfacade's 6+ listings); we've consolidated — new features ship inside the published listing rather than as separate add-ons.

| Folder | Feature | Status |
| --- | --- | --- |
| [embed/](embed/) | Embed on any website (the published add-on) | Live |
| [file-upload/](file-upload/) | File upload without Google sign-in | Scaffold, to be folded into `embed/` |
| [payments/](payments/) | Payments in the form | Scaffold, to be folded into `embed/` |
| [quiz-scoring/](quiz-scoring/) | Quiz scoring | Scaffold, to be folded into `embed/` |
| [whatsapp-delivery/](whatsapp-delivery/) | Response delivery to WhatsApp | Scaffold, to be folded into `embed/` |

Everything shares one backend (TakumiForm) — the add-on is the install funnel and the editor entry point. The actual customization, embed snippet, response handling, and payments happen on `takumiform.com` (sibling repo at [../takumiform/](../takumiform/)).

**Customize is not a separate feature entry point.** It's part of every TakumiForm plan, accessed via the dashboard on takumiform.com. The published listing's description covers "customize Google Forms" as a keyword — installing it lands the user in the customize editor. Branching is similarly a feature inside the customize editor, not a standalone product (Formfacade does the same).

Pricing stays per-feature on takumiform.com — one install unlocks the account, then the user buys the add-on SKUs they need (or the Bundle). The consolidation changes the Marketplace shape, not billing.

## Tech stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Runtime | [Google Apps Script](https://developers.google.com/apps-script), V8 | One Apps Script project per add-on |
| Add-on model | **Editor Add-on** (classic), not Workspace Add-on | Forms only supports the classic model — the Apps Script API rejects `addOns.forms.*` manifest fields. See [embed/CLAUDE.md](CLAUDE.md) for the gotcha |
| UI surface | `HtmlService` modal (not sidebar, not CardService) | Modal: more room than the ~300 px sidebar, commands attention for one-shot actions like "grab the snippet" |
| Templating | Apps Script `createTemplateFromFile(...).evaluate()` | Used to inline `Stylesheet.html` into each `Modal.html` via `<?!= include('Stylesheet') ?>` |
| Frontend | Plain HTML + JS | No framework. Server functions are called via `google.script.run` |
| OAuth scopes | `forms.currentonly` + `script.container.ui` + `script.external_request` | All non-sensitive — keeps the Marketplace verification bar low. Auto-publish once needed the sensitive `forms.body` scope (REST-only `setPublishSettings`); FormApp has since gained `setPublished()`, which authorizes under `forms.currentonly`, so we get it back for free |
| Backend calls | `UrlFetchApp` against the TakumiForm web app | Status, sync, snippet generation |
| Deploy tool | [clasp](https://github.com/google/clasp) via `npx @google/clasp@latest` | Never installed globally |

### Why a modal, not a sidebar

The form owner opens the add-on briefly to do one thing — grab the snippet, sync, configure — then closes it. Sidebars are good for persistence-while-editing, which we don't need. Modals get more attention on first run and have more room.

### Why one add-on, not five

Formfacade ships 6+ Marketplace listings, one per SEO term, and we originally planned to mirror that. Consolidating won: each new listing needs its own GCP project, consent screen, brand verification, and Google review, and splits users across installs. A feature added to the live listing is one review surface and one install. Keyword coverage moves to the listing copy and takumiform.com's SEO pages instead.

## Per-add-on layout

```
<addon>/
├── appsscript.json     manifest — scopes only, no addOns block (Forms rejects it)
├── Code.js             onOpen / onInstall / showModal / include() + server endpoints called via google.script.run
├── Snippets.js         pure helpers — string builders, URL formatters (easy to read, easy to test)
├── Modal.html          the add-on UI — HTML + inline JS, includes Stylesheet via templating
├── Stylesheet.html     shared CSS (a deliberate near-duplicate per add-on — see STYLEGUIDE.md)
└── .clasp.json.example copy to .clasp.json with your scriptId (gitignored)
```

Standard tokens, components, and copy patterns live in [STYLEGUIDE.md](STYLEGUIDE.md) so every feature's UI feels like one product.

## Working on an add-on

```sh
cd embed                                  # pick any add-on
cp .clasp.json.example .clasp.json        # then paste your scriptId
npx -y @google/clasp@latest push -f       # uploads files to the Apps Script project
```

To create a new script bound to a specific Form (only way to test classic Forms add-ons during dev):

1. Open the target Google Form
2. ⋮ menu → **Script editor** — this creates a bound script
3. Copy the script ID from the URL into `.clasp.json`
4. `npx -y @google/clasp@latest push -f`
5. Reload the form → **Extensions** menu shows your add-on

`clasp create --type forms --parentId <id>` does **not** bind to an existing form — it creates a new one. Don't waste time on it.

## Current state

- **embed/** — fully built out as a snippet generator with status check and deep links into the TakumiForm dashboard / customize editor. Deployed against a test form. Auto-publishes the form on modal open via `FormApp` `setPublished()` — no sensitive scope, no user step. Forms too old to support publishing fall back to the "click Publish yourself" footnote.
- **file-upload/**, **payments/**, **quiz-scoring/**, **whatsapp-delivery/** — scaffolded with the old (broken) CardService + Workspace Add-on manifest. Per the consolidation they won't be pushed as their own Apps Script projects; each feature gets folded into `embed/` when it ships, and its scaffold folder deleted.

## Shared deep-link contract

Every add-on links back to `https://takumiform.com/dashboard?form=<googleFormId>&feature=<slug>`. The TakumiForm web app reads `feature` and routes the user accordingly — e.g. `feature=customize` lands on `/dashboard/forms/<localId>/customize` after auto-importing the schema.

## Marketplace publishing

**Done for the one listing that matters**: *TakumiForm — Embed in Website*, published ~15 July 2026. No further listings are planned — new features land inside it. The add-on holds only non-sensitive scopes (`forms.currentonly`, `script.container.ui`, `script.external_request`), which kept its review at the lower "brand verification" bar. Renaming or re-scoping the live listing triggers an update review, so batch such changes. Details and history in [CLAUDE.md](CLAUDE.md) → "Marketplace publishing".
