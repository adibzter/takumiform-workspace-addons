# TakumiForm — Google Workspace Add-ons

One Google Forms add-on carrying multiple TakumiForm features. The published listing (*TakumiForm — Embed in Website*, built from `embed/`) is the **install funnel and editor entry point** for TakumiForm — it doesn't hold product state. Real customization, response handling, and payments live on `takumiform.com` (sibling repo at [../takumiform/](../takumiform/), see its [ARCHITECTURE.md](../takumiform/ARCHITECTURE.md)).

The other four folders (file-upload, payments, quiz-scoring, whatsapp-delivery) date from an earlier plan of one listing per Marketplace keyword. That plan is retired — see "Marketplace publishing" below. They are feature workspaces now: as each feature ships, it lands inside the published add-on, not as its own listing.

Customize is not a separate feature entry point — it's part of every TakumiForm plan, accessed via the `/dashboard` web app. The published listing is the install funnel for the customize feature too (when the user installs it, they land in the customize editor on takumiform.com). Branching is similarly a feature inside the customize editor, not a standalone product — Formfacade also bundles branching inside its Embed add-on rather than selling it separately.

Responses still land in the user's native Google Forms responses tab (and linked Sheet) — when someone submits via the takumiform-rendered form or its embed, the takumiform backend forwards the answers to Google Forms' public `formResponse` URL on the owner's behalf. From the form-owner's perspective, the add-on never has to ask for write access to responses, and nothing in this repo handles submissions.

## Why one add-on, not five

The original strategy mirrored Formfacade's 6+ Marketplace listings, one per SEO term ("customize", "embed", "file upload", etc.), each ranking for its own keyword in Marketplace search. We've consolidated instead: every new listing costs a GCP project, a consent screen, brand verification, and a Google review, and splits users across installs — while a feature added to the live listing is one review surface, one install, and one Extensions menu entry. Keyword coverage moves to the listing's title/description and the web app's SEO pages rather than separate apps. Pricing consolidated the same way (Sept 2026): takumiform.com sells one plan — Takumi Starter / Pro / Business — with every feature included; there are no per-add-on SKUs anymore.

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
- A function that opens the UI: we use a modal (`FormApp.getUi().showModalDialog(...)`). Sidebars are the other supported option but we picked modal — see UI standard below.
- Modal HTML calls server functions via `google.script.run`

## Stack

- **Google Apps Script** (V8 runtime) — one project per add-on
- **clasp** via `npx @google/clasp@latest` (don't install globally)
- **CardService not used here** — Forms add-on UIs are plain HTML served by `HtmlService`
- Manifest only declares OAuth scopes + a name; no `addOns` block

## Per-add-on layout

```
<addon>/
├── appsscript.json     manifest — scopes only, no addOns block
├── Code.js             onOpen, onInstall, showModal, include() helper, server endpoints for google.script.run
├── Snippets.js         pure helpers (string builders, URL formatters) — easy to read and test
├── Skeletons.js        embed only: fetches a form skeleton from the web app and writes its items into the form with FormApp
├── Modal.html          the add-on UI (HTML + inline JS) — pulls shared CSS via <?!= include('Stylesheet') ?>
├── Stylesheet.html     shared CSS — see ../STYLEGUIDE.md (deliberate near-duplicate per add-on)
└── .clasp.json         scriptId — gitignored, copy from .clasp.json.example
```

## UI standard

Every add-on surface uses the same tokens, components, layout container, and copy patterns so each feature's UI feels like one product. The standard lives in [STYLEGUIDE.md](STYLEGUIDE.md) — read it before building a new feature's modal.

**Container is a modal**, not a sidebar. The user opens the add-on briefly to do one thing (grab snippet, configure) then closes it. Modal commands attention on first run and gives more room than the ~300px sidebar. Trade-off documented in STYLEGUIDE.md.

**Sync is push-only, from the add-on, at two moments.** The web app holds no Forms scope, so it can never pull a form; it only receives what the add-on POSTs to `/api/forms/addon-sync`. That happens (1) when the modal opens on a connected form (`Code.js` pushes in the background and ignores the result, failures land in Stackdriver, never in the user's face) and (2) when the user presses the small **Sync now** link in the connected status row (`resyncNow()`, which shows "Synced X ago" / "Sync failed, try again" inline). There is no dashboard Sync button and no hourly or background sync: a time-driven trigger would need the `script.scriptapp` scope, which the owner declined. So a form edit reaches TakumiForm (and a site built from the form) only when the modal is opened or Sync now is pressed; user-facing copy should say exactly that.

**Images ride the sync as hashes, then upload on request.** `serializeItem` in [embed/Snippets.js](embed/Snippets.js) hashes each image item's bytes (`Utilities.computeDigest`, SHA-256) and puts only `imageItem: { image: { sha256, contentType, altText }, width, alignment }` in the JSON; the blobs travel separately in the `images` map `buildSyncPayload` returns, which `Code.js` strips before the sync POST. The web app answers `/api/forms/addon-sync` with `missingImages: [sha256, ...]`, and `uploadMissingImages` POSTs each one as `multipart/form-data` (`formId`, `sha256`, `file`) to `/api/forms/addon-image`, at most 20 per push. Hashes the web app already holds are never re-sent, so a steady-state sync costs one call as before. Images over 10 MB, or any FormApp read that throws, serialize as the bare `imageItem: {}` they always did. Upload failures are logged, never surfaced: the next sync asks again. A form that isn't connected yet gets `missingImages: []` from the staged path, so its images arrive on the first sync after connect.

**The disconnected modal auto-polls for connection.** A first-time user clicks one of the two connect links (opens takumiform.com in a new tab), signs in, then returns to the form. Rather than make them click a refresh button, the modal polls `checkConnection()` (a cheap status-only server call in `Code.js` that, unlike `getEmbedData`, never re-pushes the schema) every 4s and flips to the connected view automatically the moment the form shows up. Manual "Refresh now" stays as a fallback; polling gives up after 10 min. This fixed a Marketplace review rejection — the reviewer connected, saw the modal not update, and flagged it. When adding a new add-on with a connect step, copy this poll loop from [embed/Modal.html](embed/Modal.html).

**The modal is mode-aware (Oct 2026).** A form is either embedded or a site, and the web app records which on first connect. `GET /api/forms/status` answers `{ connected: true, updatedAt, mode: 'form' | 'site', siteUrl, sitePublished }` or `{ connected: false }`; `fetchStatus` in `Code.js` normalizes that, reading a missing `mode` as `'form'` so an older server still paints the snippet state. The welcome state offers two connect links instead of one: **Embed this form** (`feature=embed`, primary) and **Build a site from this form** (`feature=site`), with a one-liner saying the choice can be changed later in the dashboard. The connected state branches on `mode`: `form` is the snippet view as before; `site` drops the snippet and shows **Open site** (`siteUrl`, only when `sitePublished`, otherwise **Site settings** takes the primary slot so there's no dead button), **Site settings** (the `feature=site` deep link, which the dashboard resolves to the Site tab) and **Customize**. `getEmbedData()` passes `mode`, `siteUrl`, `sitePublished`, `connectSiteUrl` and `siteSettingsUrl` through alongside the existing fields.

**Start from a template** is a collapsed `<details>` on every modal state (collapsed so the connected form state still fits the fixed 560×500 dialog). On first expand the modal calls `listSkeletons()`, which fetches `GET /api/sites/skeletons.json` (`{ skeletons: [{ id, vertical, name }] }`) and fills a `<select>` grouped by vertical, with loading and failure states and a retry link. **Apply to this form** calls `applySkeleton(skeletonId, allowAppend)`: it fetches `/api/sites/skeletons/<id>.json` and writes the items into the active form with FormApp under `forms.currentonly` (`section` → page break, `text` → section header, `image` → image item fed by a sample fetched from our origin, `choice` → multiple choice or checkbox, `short` → text item with an optional phone or email `TextValidation`, `paragraph`, `date`, `time`), then runs the normal `triggerSchemaPush` so the dashboard sees the new structure. A form that already has items gets `{ ok: false, error: 'not-empty' }`; the modal asks inline ("Add the template's items after them?") and retries with `allowAppend = true`. The confirm is in-page rather than `window.confirm`, which the Apps Script sandbox doesn't reliably allow. One bad item is logged and skipped, never fatal, and the result reports `{ added, skipped }`; sample images are fetched *before* the image item is added so a missing sample leaves no empty item behind. After a template is applied the site connect link gains `&skeleton=<id>` and **Build a site from this form** becomes the primary button on the welcome state (Embed drops to secondary), since a site is the natural next step. On first connect with `feature=site` the web app creates a draft site (address auto-picked from the form title) and applies the vertical's curated site template for that skeleton; nothing is published until the owner presses Publish on the Site tab. The per-type mapping lives in [embed/Skeletons.js](embed/Skeletons.js); `Code.js` only holds the two entry points.

**The form is published for the user, silently.** `getEmbedData()` calls `publishActiveForm()` before pushing the schema, so by the time the modal paints, the form accepts responses. Success is invisible — no confirmation, no banner — because a user who is grabbing an embed snippet has already decided to collect responses and doesn't need to be told a prerequisite was met. Only a hard failure renders (the `.publish-status--error` banner), and only then does the modal fall back to telling the user to click Google's own Publish button. Note `setPublished()` and `isPublished()` **throw** on forms predating the 2024 publish workflow, so the `supportsAdvancedResponderPermissions()` guard is required; those forms report `unsupported`, which is treated as a non-event rather than an error.

The shared CSS ships as `Stylesheet.html` in each add-on (a deliberate copy, not an import). Modal.html loads Google's editor add-on CSS package first (a Marketplace review recommendation), then includes ours via Apps Script templating so TakumiForm tokens win where they overlap:

```html
<link rel="stylesheet" href="https://ssl.gstatic.com/docs/script/css/add-ons1.css">
<?!= include('Stylesheet') ?>
```

This requires `showModal()` to use `createTemplateFromFile(...).evaluate()` and an `include()` helper in Code.js — copy both from [embed/Code.js](embed/Code.js) when you set up a new add-on.

## Working on an add-on

```
cd <addon>
cp .clasp.json.example .clasp.json   # then paste your scriptId
npx -y @google/clasp@latest push -f  # uploads files to the Apps Script project
```

**After any code change to an add-on, run `npx -y @google/clasp@latest push -f` from that add-on's folder.** Apps Script doesn't pick up local edits otherwise — the bound script in the test form keeps running the old code until you push. Always push before reporting work as done.

**After code changes, update the relevant `.md` docs in the same pass** — this `CLAUDE.md`, `STYLEGUIDE.md`, and the matching `docs/addons/<addon>.md` over in the sibling [../takumiform/](../takumiform/) repo. Stale docs are worse than missing ones.

**Don't run `git add`, `git commit`, or `git push`.** The human handles all git operations — leave changes unstaged for them to review. (This is separate from `clasp push`, which you *should* run — that pushes to Apps Script, not git.)

To create a new script bound to a specific Form (only way to test classic Forms add-ons during dev):

1. Open the target Google Form
2. ⋮ menu → **Script editor** — this creates a bound script
3. Copy the script ID from the URL into `.clasp.json`
4. `npx -y @google/clasp@latest push -f`
5. Reload the form → **Extensions menu** shows your add-on

`clasp create --type forms --parentId <id>` does **not** bind to an existing form — it creates a new one. Don't waste time on it.

## Current state

- **embed/** — built out as a real snippet generator. Deployed against test form bound to script `10ulqZJvGWQtZehNsBsiB33e_lxcWRa825NL__5Y6DrjNhH6ZEbl-pYKE`. The menu item is **Open TakumiForm** and the dialog title is plain **TakumiForm** (MARKETPLACE.md §5–7, applied Sept 2026); the connected form view links Preview / Customize / File upload, the last via `uploadsUrl` → `feature=file-upload`. Since Oct 2026 the modal is mode-aware (two connect links on the welcome state, a site view without the snippet when the form is a site) and carries a "Start from a template" section that writes a form skeleton into the form; see "UI standard" above. The web app's dashboard onboarding and docs quote that menu label, so push this project whenever the label changes.
- **file-upload/**, **payments/**, **quiz-scoring/**, **whatsapp-delivery/** — still scaffolded with the old (broken) CardService + Workspace Add-on shape, and per the consolidation they will never be pushed as their own Apps Script projects. When one of these features ships, its UI and server calls get folded into `embed/` (a new tab or view in that modal), and the scaffold folder gets deleted.

## Agents

`.claude/agents/addon-worker.md` builds and reviews the add-on: it holds the rules above, the table of web-app endpoints the add-on depends on, and the finish steps (clasp push, manual test list, docs in both repos). When a rule here or an endpoint in that table changes, update the agent too. The web app's own agents (`pm`, `claim-checker`, `code-reviewer`) live in `../takumiform/.claude/agents/`.

## Marketplace publishing

**`embed` is live** — listed as *TakumiForm — Embed in Website*, published ~15 July 2026:
<https://workspace.google.com/marketplace/app/takumiform_embed_in_website/61166924939>
(the same URL is the `MARKETPLACE_URL` constant at the top of the web app's `src/pages/index.astro`).

It took one rejection to get there: the reviewer connected a form, saw the modal not
update, and flagged it — fixed by the connection poll loop described above. Google's
review account (`gsm…@marketplacetest.net`) shows up in the users table dated 15 July,
which is the most reliable record of when review actually ran.

The other four add-ons have **no listing** and, per the decision to consolidate, aren't
getting one — new features land in the published listing instead. Renaming or re-scoping
that listing now means an update review of a live app, so batch such changes rather than
trickling them.

Each *new* listing (should we ever add one) needs:
- A GCP project
- OAuth consent screen + brand verification. Every add-on (including `embed`) holds only non-sensitive scopes (`forms.currentonly`, `script.container.ui`, `script.external_request`), so the verification bar is the lower "brand only" review — not the sensitive-scope justification the web app needs for `forms.body.readonly`. **Keep it that way.** Auto-publish is the one feature that has tempted us over the line: it once used the REST `setPublishSettings` endpoint and the sensitive `forms.body` scope, was dropped for that reason, and is now back via FormApp's `setPublished()` under `forms.currentonly`. If a future feature seems to need a sensitive scope, check the FormApp reference first — it keeps absorbing REST-only capabilities.
- Marketplace SDK config
- Screenshots, privacy policy URL, terms URL
- Google review

Consent-screen verification on the web app was the long pole (4–6 week lead time); the
add-on listing followed cheaply because its scopes are non-sensitive.

## Don't over-engineer

The simplest thing that works wins. We learned this the hard way already — the first version of these add-ons used CardService and a Workspace Add-on manifest that Forms doesn't actually support. The fix wasn't a clever workaround; it was the older, simpler, supported model.

- **Prefer the boring supported path over the new shiny one.** Forms add-ons have used `onOpen` + `HtmlService` for years. That's what works. Don't try to retrofit it into something else.
- **Add a file or abstraction only when its absence is causing real pain.** Each add-on has four files: manifest, entry points, snippet helpers, modal HTML. That's enough. Don't introduce a build step, a bundler, or a shared library across add-ons unless you genuinely need one.
- **Copy-paste between add-ons is fine for now.** Five small near-duplicates are easier to read than one factored abstraction with five config files.
- **Modal UI is plain HTML.** No React, no Solid, no framework — `google.script.run` plus DOM updates is enough.

When tempted to add a layer, ask: *is this solving a problem we have today, or one we imagine having?* If it's the second one, don't.

## Code style

We optimize for **maintainability and readability** over cleverness. The next person on this codebase — including future-you in six months — should be able to open any file and understand it without a tour.

- **Names describe the thing, not the type.** `formId` not `fid` or `id`. `scriptSnippet(formId)` not `s(f)`. Acronyms are OK only if they're domain terms (`url`, `id`, `html`).
- **Boring code over clever code.** Three obvious lines beat one regex-laden one-liner. No "look ma, no temporaries".
- **One responsibility per file.** [Snippets.js](embed/Snippets.js) only builds strings. [Code.js](embed/Code.js) only handles entry points. [Modal.html](embed/Modal.html) only renders UI.
- **Co-locate the data with the code that uses it.** Constants like `CDN_URL`, `NPM_PKG`, `APP_BASE` live at the top of the file that consumes them, not in a global `constants.js`.
- **Default to no comments.** Only add one when the *why* is non-obvious (a Google API quirk, a workaround, a security constraint). Don't restate what the code already says.
- **Plain functions over abstractions.** No classes unless there's actual state. No "manager" / "helper" / "util" classes — those are noise.
- **Keep files short.** If a file is over ~200 lines, that's a hint to split it along a real seam (a new domain, not a new file type).
- **Match the existing patterns.** When adding a new add-on, copy `embed/` and change what's different. Don't invent a new layout.
