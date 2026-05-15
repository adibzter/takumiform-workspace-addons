# TakumiForm — Google Workspace Add-ons

Five Google Forms add-ons, one per Marketplace listing keyword (customize, embed, file-upload, payments, quiz-scoring). They are the **install funnel and editor entry point** for TakumiForm — they don't hold product state. Real customization, response handling, and payments live on `takumiform.com` (sibling repo at [../takumiform/](../takumiform/), see its [ARCHITECTURE.md](../takumiform/ARCHITECTURE.md)).

## Why one add-on per keyword

Formfacade has 6+ Marketplace listings, one per SEO term ("customize", "embed", "file upload", etc.). Each listing ranks for its own keyword in the Workspace Marketplace search. We're mirroring that strategy with five listings. All five point users back to the same takumiform.com account.

## Forms add-ons are NOT Workspace add-ons

This is the one thing that will bite you. Google has two add-on models:

| Model | Triggers it works with | Manifest field | UI |
| --- | --- | --- | --- |
| **Workspace Add-on** | Gmail, Calendar, Drive, Docs, Sheets, Slides | `addOns.*.homepageTrigger` | CardService |
| **Editor Add-on (classic)** | Forms, plus older Docs/Sheets/Slides | `onOpen(e)` function | `HtmlService` sidebar |

**Forms is Editor Add-on only.** The Apps Script API will reject `addOns.forms.*` manifest fields. We learned this the hard way during the first push. Don't try to reintroduce them.

Editor add-on entry points:
- `onOpen(e)` — registers the menu via `FormApp.getUi().createAddonMenu()`
- `onInstall(e)` — usually just delegates to `onOpen`
- A function that opens the sidebar: `HtmlService.createHtmlOutputFromFile('Sidebar')` → `FormApp.getUi().showSidebar(...)`
- Sidebar HTML calls server functions via `google.script.run`

## Stack

- **Google Apps Script** (V8 runtime) — one project per add-on
- **clasp** via `npx @google/clasp@latest` (don't install globally)
- **CardService not used here** — Forms sidebars are plain HTML served by `HtmlService`
- Manifest only declares OAuth scopes + a name; no `addOns` block

## Per-add-on layout

```
<addon>/
├── appsscript.json     manifest — scopes only, no addOns block
├── Code.js             onOpen, onInstall, showSidebar, include() helper, server endpoints for google.script.run
├── Snippets.js         pure helpers (string builders, URL formatters) — easy to read and test
├── Sidebar.html        the sidebar UI (HTML + inline JS) — pulls shared CSS via <?!= include('Stylesheet') ?>
├── Stylesheet.html     shared sidebar CSS — see ../STYLEGUIDE.md (deliberate near-duplicate per add-on)
└── .clasp.json         scriptId — gitignored, copy from .clasp.json.example
```

## Sidebar standard

Every add-on's sidebar uses the same tokens, components, and copy patterns so the five Marketplace listings feel like one product. The standard lives in [STYLEGUIDE.md](STYLEGUIDE.md) — read it before building a new sidebar.

The shared CSS ships as `Stylesheet.html` in each add-on (a deliberate copy, not an import). Sidebar.html includes it via Apps Script templating:

```html
<?!= include('Stylesheet') ?>
```

This requires `showSidebar()` to use `createTemplateFromFile(...).evaluate()` and an `include()` helper in Code.js — copy both from [embed/Code.js](embed/Code.js) when you set up a new add-on.

## Working on an add-on

```
cd <addon>
cp .clasp.json.example .clasp.json   # then paste your scriptId
npx -y @google/clasp@latest push -f  # uploads files to the Apps Script project
```

To create a new script bound to a specific Form (only way to test classic Forms add-ons during dev):

1. Open the target Google Form
2. ⋮ menu → **Script editor** — this creates a bound script
3. Copy the script ID from the URL into `.clasp.json`
4. `npx -y @google/clasp@latest push -f`
5. Reload the form → **Extensions menu** shows your add-on

`clasp create --type forms --parentId <id>` does **not** bind to an existing form — it creates a new one. Don't waste time on it.

## Current state

- **embed/** — built out as a real snippet generator. Deployed against test form bound to script `10ulqZJvGWQtZehNsBsiB33e_lxcWRa825NL__5Y6DrjNhH6ZEbl-pYKE`.
- **customize/**, **file-upload/**, **payments/**, **quiz-scoring/** — still scaffolded with the old (broken) CardService + Workspace Add-on shape. They need conversion to the same Editor Add-on pattern as `embed/` before they can be pushed.

## Marketplace publishing — not done

Each listing needs:
- A GCP project
- OAuth consent screen + brand verification (`forms.currentonly` is non-sensitive, so the verification bar is lower than the web app's `forms.body.readonly`)
- Marketplace SDK config
- Screenshots, privacy policy URL, terms URL
- Google review

Start the consent-screen verification on the web app first (4–6 week lead time, restricted scopes); the add-on listings can follow because their scopes are non-sensitive.

## Don't over-engineer

The simplest thing that works wins. We learned this the hard way already — the first version of these add-ons used CardService and a Workspace Add-on manifest that Forms doesn't actually support. The fix wasn't a clever workaround; it was the older, simpler, supported model.

- **Prefer the boring supported path over the new shiny one.** Forms add-ons have used `onOpen` + `HtmlService` for years. That's what works. Don't try to retrofit it into something else.
- **Add a file or abstraction only when its absence is causing real pain.** Each add-on has four files: manifest, entry points, snippet helpers, sidebar HTML. That's enough. Don't introduce a build step, a bundler, or a shared library across add-ons unless you genuinely need one.
- **Copy-paste between add-ons is fine for now.** Five small near-duplicates are easier to read than one factored abstraction with five config files.
- **Sidebar UI is plain HTML.** No React, no Solid, no framework — `google.script.run` plus DOM updates is enough for a sidebar.

When tempted to add a layer, ask: *is this solving a problem we have today, or one we imagine having?* If it's the second one, don't.

## Code style

We optimize for **maintainability and readability** over cleverness. The next person on this codebase — including future-you in six months — should be able to open any file and understand it without a tour.

- **Names describe the thing, not the type.** `formId` not `fid` or `id`. `scriptSnippet(formId)` not `s(f)`. Acronyms are OK only if they're domain terms (`url`, `id`, `html`).
- **Boring code over clever code.** Three obvious lines beat one regex-laden one-liner. No "look ma, no temporaries".
- **One responsibility per file.** [Snippets.js](embed/Snippets.js) only builds strings. [Code.js](embed/Code.js) only handles entry points. [Sidebar.html](embed/Sidebar.html) only renders UI.
- **Co-locate the data with the code that uses it.** Constants like `CDN_URL`, `NPM_PKG`, `APP_BASE` live at the top of the file that consumes them, not in a global `constants.js`.
- **Default to no comments.** Only add one when the *why* is non-obvious (a Google API quirk, a workaround, a security constraint). Don't restate what the code already says.
- **Plain functions over abstractions.** No classes unless there's actual state. No "manager" / "helper" / "util" classes — those are noise.
- **Keep files short.** If a file is over ~200 lines, that's a hint to split it along a real seam (a new domain, not a new file type).
- **Match the existing patterns.** When adding a new add-on, copy `embed/` and change what's different. Don't invent a new layout.
