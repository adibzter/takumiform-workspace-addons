# TakumiForm Add-on UI Standard

The visual + interaction standard every TakumiForm Workspace add-on follows. Five add-ons, one feel.

The standard lives as `Stylesheet.html` in each add-on (a deliberate near-duplicate per [CLAUDE.md](CLAUDE.md)'s "copy-paste between add-ons is fine" rule). When you tweak it, copy the change to every sibling — there's no shared package, by design.

## Container: modal, not sidebar

We use **modal dialogs** (`FormApp.getUi().showModalDialog`), not sidebars. Reasoning:

- The user opens the add-on briefly (grab snippet, hit sync, leave) — sidebar's "persists alongside the form" advantage isn't useful for this job.
- Modal commands attention on first run, which matters most when we're trying to convert.
- More room than the ~300px sidebar — snippet textarea isn't cramped, layouts breathe.
- One container = one mental model. No "where did the welcome go?" moment.

Default dimensions: `setWidth(560).setHeight(560)`. Adjust per add-on if a use case genuinely needs more.

If a future add-on truly needs the user to see UI *while* editing the form (e.g. live response counter), introduce a sidebar at that point. Don't pay for both up-front.

For the dashboard / marketing site equivalent, see [../takumiform/CLAUDE.md](../takumiform/CLAUDE.md) → "Layouts and design system." The systems are deliberately separate:

| | Where it lives | What sets the feel | Owner |
| --- | --- | --- | --- |
| **Add-on UI** (this doc) | `<addon>/Stylesheet.html` | TakumiForm brand color + Google's neutrals + Google Sans | Us |
| **Dashboard / marketing** | `src/styles/global.css` `@theme` | Tailwind tokens (`--color-brand-*`, `--color-ink-*`) | Us |
| **Public form renderer** | `src/features/customize/theme.ts` (`--tk-*`) | Per-form, owner-controlled | End users |

## Why separate?

Each system runs in a different host. The add-on modal runs *inside* Google's Forms editor — using Google's neutrals + typography keeps it from feeling like an alien plugin. The dashboard runs on its own domain — it should feel fully TakumiForm. The form renderer is whatever the form owner says it is.

If we share a stylesheet across hosts, every UI tweak risks clobbering an unrelated surface. Each host owns its tokens.

## Tokens

Defined in `Stylesheet.html` as CSS variables. Use them via `var(--tk-*)`; never hard-code a hex.

Palette is TakumiForm vermillion (朱 / shu) on warm stone — same direction as the web app, so the add-on feels like part of the product instead of a generic Forms plugin. The web app's equivalent tokens live in `../takumiform/src/styles/global.css`; keep the two in sync if you ever shift the brand.

```
--tk-brand        #b91d2d   primary action, links inside the modal (vermillion)
--tk-brand-hover  #951725   hover state for primary buttons
--tk-brand-soft   #fdf3f1   reserved for tints (badges, subtle fills)

--tk-text         #1c1917   primary text — warm stone-900
--tk-text-muted   #44403c   body copy, secondary statements
--tk-text-subtle  #78716c   labels, hints, meta lines
--tk-border       #d6d3d1   form controls, button borders
--tk-divider      #e7e5e4   horizontal rules between sections
--tk-surface      #fafaf9   snippet/textarea background
--tk-surface-2    #f5f5f4   button hover surface

--tk-ok / --tk-ok-bg          green — connected/synced
--tk-warn / --tk-warn-bg      amber — disconnected/unpublished
--tk-danger                   red   — error states only

--tk-radius-btn   8px       buttons
--tk-radius-input 6px       inputs, snippet boxes
--tk-radius-pill  999px     badges
```

## Components

Every add-on's modal should compose from this vocabulary. If you find yourself inventing a new class, that's a hint — first check if an existing component fits with one extra modifier. If not, add it to `Stylesheet.html` *and document it here*, then copy the change to every sibling.

### Type

```html
<p class="welcome-title">Embed this form on your site</p>
<p class="title">Form name</p>
<p class="lead">One-line description of what the add-on does for this form.</p>
<p class="label">Section label</p>
<p class="hint">Small helper text under inputs/snippets.</p>
<p class="footnote">Free for 100 responses/mo. No card.</p>
```

| Class | Use for |
| --- | --- |
| `.welcome-title` | Big heading on the welcome / disconnected state. Lead with the value prop, not the form's name |
| `.title` | Connected-state header — the form's title |
| `.lead` | Intro paragraph below the title |
| `.label` | Uppercase tracking-wide section labels |
| `.hint` | 12px helper copy under controls |
| `.footnote` | Centered 11px text under a primary action (e.g. pricing reassurance) |

### Checklist

Short list of benefits with brand-colored checkmarks. Use on welcome screens. Keep it to 3–5 items — longer lists get skimmed.

```html
<ul class="checklist">
  <li>Works on any site</li>
  <li>Match your colors and fonts</li>
  <li>Auto-syncs when you edit the form</li>
</ul>
```

### Badge

Status pill with a colored dot. Goes near the top of the modal to telegraph state.

```html
<span class="badge ok">Connected</span>
<span class="badge no">Not connected</span>
```

| Modifier | Meaning |
| --- | --- |
| `.ok` | Connected, synced, published, working |
| `.no` | Disconnected, action needed |

### Button

```html
<a class="btn primary" href="...">Connect to TakumiForm</a>
<a class="btn" href="...">Open dashboard</a>
<div class="row">
  <a class="btn" href="...">Preview</a>
  <a class="btn" href="...">Open dashboard</a>
</div>
```

- One `.primary` per screen — the main thing the user should do next.
- Stack with `.btn + .btn` (auto top-margin).
- Use `.row` for two equal-weight side-by-side actions.

### Snippet box

Code blob with a Copy button overlay.

```html
<div class="snippet">
  <textarea id="s1" rows="4" readonly>{value}</textarea>
  <button class="copy" data-target="s1">Copy</button>
</div>
```

JS lives in the page; toggling `.copied` flips the button to a green "Copied" state for 1.5s. Pattern is identical across add-ons — copy the wireup function from `embed/Modal.html`.

### Inline link

For low-emphasis actions that aren't full buttons ("Refresh status", "I've connected").

```html
<button class="link" id="refresh">Refresh status</button>
```

### Status row

Badge + meta line on a single wrapping row. Use as the header of a connected/active state — badge tells the user what state they're in, meta line offers actions inline.

```html
<div class="status-row">
  <span class="badge ok">Connected</span>
  <span class="status-meta">
    Synced 2 min ago
    <span class="dot">·</span>
    <a href="..." target="_blank">Sync now</a>
    <span class="dot">·</span>
    <button class="link">Refresh</button>
  </span>
</div>
```

### Collapsible section

For options the user doesn't usually need.

```html
<details>
  <summary>Iframe option (no JavaScript)</summary>
  <div>...</div>
</details>
```

### Loading / error

Centered, padded, used inside the root container.

```html
<div class="loading">Loading…</div>
<div class="error">Could not read form: {message}</div>
```

## Copy

Match the project copy guidelines (see `../takumiform/CLAUDE.md`). Specifically:

- **Avoid**: "supercharge", "perfected", "everything X is missing", parallel triplet sentences, em-dashes as a stylistic crutch, fake stats.
- **Prefer**: one clear sentence, mild opinion, contractions, occasional "yep" / "mostly".
- **Modal voice is short.** You have ~560px and the user wants out fast. Two-line lead, then components.

## Layout

- **Padding**: `body { padding: 16px }` — set by `Stylesheet.html`. Don't override per add-on.
- **Vertical rhythm**: 14–18px between sections (the components have their own margins; trust them).
- **Width**: 560px (modal default). Don't add horizontal scrolling. Long text wraps; long URLs go in a `.snippet` textarea.
- **No grids or columns** beyond the `.row` pattern (two side-by-side buttons). Modals are vertical stacks.

## Interaction

- **One primary action per screen.** The user shouldn't have to think about which button is "the" button.
- **Refresh is always available** when the modal shows server-fetched state. Use the `.refresh` block at the bottom or inline `<button class="link" id="refresh">`.
- **Loading state for every fetch.** Replace the root with `<div class="loading">Loading…</div>` while waiting.
- **Errors degrade gracefully.** Show the error in a `.error` block; don't crash the modal.
- **External links open in new tabs.** `<base target="_top">` in the head handles this.

## Wiring it up

In your add-on's `Code.js`:

```js
function showModal() {
  const html = HtmlService.createTemplateFromFile('Modal')
    .evaluate()
    .setWidth(560)
    .setHeight(560);
  FormApp.getUi().showModalDialog(html, 'TakumiForm — <Add-on>');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
```

In your add-on's `Modal.html`:

```html
<!DOCTYPE html>
<html>
  <head>
    <base target="_top">
    <?!= include('Stylesheet') ?>
  </head>
  <body>
    <div id="root"><div class="loading">Loading…</div></div>
    <script>
      // ...your modal logic, using the components above
    </script>
  </body>
</html>
```

Drop `Stylesheet.html` in the add-on folder — content is identical to `embed/Stylesheet.html`. **Copy the file, don't symlink, don't import.**

## When the standard needs to change

1. Make the change in one add-on's `Stylesheet.html` first
2. Confirm it looks right in that add-on
3. Copy the same change to every other add-on's `Stylesheet.html`
4. Update this doc to reflect the new component or token
5. Push every add-on (`clasp push -f` per addon folder)

If you find yourself doing #3 often, that's the signal to introduce a build step. Until then, five copy-pastes is cheaper than the abstraction.
