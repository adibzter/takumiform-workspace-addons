# TakumiForm — Google Workspace Add-ons

Five separate Google Forms add-ons, one per Marketplace listing keyword. The "one product per keyword" strategy mirrors how Formfacade ships 6+ Marketplace listings.

| Folder | Marketplace listing | Tier |
| --- | --- | --- |
| [customize/](customize/) | "Customize Google Forms" | 1 |
| [embed/](embed/) | "Embed Google Forms" | 1 |
| [file-upload/](file-upload/) | "Google Forms File Upload (No Login)" | 1 |
| [payments/](payments/) | "Google Forms Payments" | 2 |
| [quiz-scoring/](quiz-scoring/) | "Google Forms Quiz Scoring" | 2 |

All add-ons share one backend (TakumiForm) — each add-on is the install funnel and the editor entry point. The actual customization, embed snippet, response handling, and payments happen on `takumiform.com` (sibling repo at [../takumiform/](../takumiform/)).

## Tech stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Runtime | [Google Apps Script](https://developers.google.com/apps-script), V8 | One Apps Script project per add-on |
| Add-on model | **Editor Add-on** (classic), not Workspace Add-on | Forms only supports the classic model — the Apps Script API rejects `addOns.forms.*` manifest fields. See [embed/CLAUDE.md](CLAUDE.md) for the gotcha |
| UI surface | `HtmlService` modal (not sidebar, not CardService) | Modal: more room than the ~300 px sidebar, commands attention for one-shot actions like "grab the snippet" |
| Templating | Apps Script `createTemplateFromFile(...).evaluate()` | Used to inline `Stylesheet.html` into each `Modal.html` via `<?!= include('Stylesheet') ?>` |
| Frontend | Plain HTML + JS | No framework. Server functions are called via `google.script.run` |
| OAuth scopes | `forms.currentonly` + `forms.body` (REST) + `script.external_request` | Non-sensitive — keeps the Marketplace verification bar low |
| Backend calls | `UrlFetchApp` against the TakumiForm web app | Status, sync, snippet generation |
| Deploy tool | [clasp](https://github.com/google/clasp) via `npx @google/clasp@latest` | Never installed globally |

### Why a modal, not a sidebar

The form owner opens the add-on briefly to do one thing — grab the snippet, sync, configure — then closes it. Sidebars are good for persistence-while-editing, which we don't need. Modals get more attention on first run and have more room.

### Why one add-on per keyword

Formfacade has 6+ Marketplace listings, one per SEO term ("customize", "embed", "file upload", etc.). Each listing ranks for its own keyword in the Workspace Marketplace search. We mirror that strategy. All five listings point users back to the same takumiform.com account.

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

Standard tokens, components, and copy patterns live in [STYLEGUIDE.md](STYLEGUIDE.md) so all five listings feel like one product.

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

- **embed/** — fully built out as a snippet generator with status check, auto-publish on modal open, and deep links into the TakumiForm dashboard / customize editor. Deployed against a test form.
- **customize/**, **file-upload/**, **payments/**, **quiz-scoring/** — scaffolded with the old (broken) CardService + Workspace Add-on manifest. Need conversion to the Editor Add-on pattern shown in `embed/` before they can be pushed.

## Shared deep-link contract

Every add-on links back to `https://takumiform.com/app?form=<googleFormId>&feature=<slug>`. The TakumiForm web app reads `feature` and routes the user accordingly — e.g. `feature=customize` lands on `/app/forms/<localId>/customize` after auto-importing the schema.

## Marketplace publishing

Not yet done. Each listing needs a GCP project, OAuth consent screen + brand verification, Marketplace SDK config, screenshots, privacy/terms URLs, and Google review. The non-sensitive scopes (`forms.currentonly`, `forms.body`) keep the bar low. Start the consent-screen verification on the web app first (4–6 week lead time); the add-on listings can follow.
