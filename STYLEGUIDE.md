# TakumiForm Sidebar Standard

The visual + interaction standard every TakumiForm Workspace add-on follows. Five add-ons, one feel.

The standard lives as `Stylesheet.html` in each add-on (a deliberate near-duplicate per [CLAUDE.md](CLAUDE.md)'s "copy-paste between add-ons is fine" rule). When you tweak it, copy the change to every sibling — there's no shared package, by design.

For the dashboard / marketing site equivalent, see [../takumiform/CLAUDE.md](../takumiform/CLAUDE.md) → "Layouts and design system." The two systems are deliberately separate:

| | Where it lives | What sets the feel | Owner |
| --- | --- | --- | --- |
| **Sidebar standard** (this doc) | `<addon>/Stylesheet.html` | TakumiForm brand color + Google's neutrals + Google Sans | Us |
| **Dashboard / marketing** | `src/styles/global.css` `@theme` | Tailwind tokens (`--color-brand-*`, `--color-ink-*`) | Us |
| **Public form renderer** | `src/features/customize/theme.ts` (`--tk-*`) | Per-form, owner-controlled | End users |

## Why separate?

Each system runs in a different host. The sidebar runs *inside* Google's Forms editor — using Google's neutrals + typography keeps it from feeling like an alien plugin. The dashboard runs on its own domain — it should feel fully TakumiForm. The form renderer is whatever the form owner says it is.

If we share a stylesheet across hosts, every UI tweak risks clobbering an unrelated surface. Each host owns its tokens.

## Tokens

Defined in `Stylesheet.html` as CSS variables. Use them via `var(--tk-*)`; never hard-code a hex.

```
--tk-brand        #4f46e5   primary action, links inside the sidebar
--tk-brand-hover  #4338ca   hover state for primary buttons
--tk-brand-soft   #eef2ff   reserved for tints (badges, subtle fills)

--tk-text         #202124   primary text — matches Forms editor
--tk-text-muted   #3c4043   body copy, secondary statements
--tk-text-subtle  #5f6368   labels, hints, meta lines
--tk-border       #dadce0   form controls, button borders
--tk-divider      #e8eaed   horizontal rules between sections
--tk-surface      #f8f9fa   snippet/textarea background
--tk-surface-2    #f1f3f4   button hover surface

--tk-ok / --tk-ok-bg          green — connected/synced
--tk-warn / --tk-warn-bg      amber — disconnected/unpublished
--tk-danger                   red   — error states only

--tk-radius-btn   8px       buttons
--tk-radius-input 6px       inputs, snippet boxes
--tk-radius-pill  999px     badges
```

## Components

Every add-on's sidebar should compose from this vocabulary. If you find yourself inventing a new class, that's a hint — first check if an existing component fits with one extra modifier. If not, add it to `Stylesheet.html` *and document it here*, then copy the change to every sibling.

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

Status pill with a colored dot. Goes near the top of the sidebar to telegraph state.

```html
<span class="badge ok">Connected</span>
<span class="badge no">Not connected</span>
```

| Modifier | Meaning |
| --- | --- |
| `.ok` | Connected, synced, published, working |
| `.no` | Disconnected, action needed |

### Checkbox

Opt-in toggle. Label wraps the input so the entire line is clickable. Use sparingly — sidebars don't have room for many of these. Good for one default-checked option above a primary button (e.g. "Also publish my form").

```html
<label class="checkbox">
  <input type="checkbox" id="auto-publish" checked />
  <span>Also publish my form on Google so anyone with the link can respond.</span>
</label>
```

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

JS lives in the page; toggling `.copied` flips the button to a green "Copied" state for 1.5s. Pattern is identical across add-ons — copy the wireup function from `embed/Sidebar.html`.

### Inline link

For low-emphasis actions that aren't full buttons ("Refresh status", "I've connected").

```html
<button class="link" id="refresh">Refresh status</button>
```

### Freshness line

For "Synced X ago" with inline secondary actions.

```html
<p class="freshness">
  Synced 2 min ago.
  <a href="..." target="_blank">Sync now</a>
  <span class="dot">·</span>
  <button class="link">Refresh status</button>
</p>
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
- **Sidebar voice is short.** You have ~300px of width. Two-line lead, then components.

## Layout

- **Padding**: `body { padding: 16px }` — set by `Stylesheet.html`. Don't override per add-on.
- **Vertical rhythm**: 14–18px between sections (the components have their own margins; trust them).
- **Width**: assume ~300px. Don't add horizontal scrolling. Long text wraps; long URLs go in a `.snippet` textarea.
- **No grids or columns** beyond the `.row` pattern (two side-by-side buttons). Sidebars are vertical lists.

## Interaction

- **One primary action per screen.** The user shouldn't have to think about which button is "the" button.
- **Refresh is always available** when the sidebar shows server-fetched state. Use the `.refresh` block at the bottom or inline `<button class="link" id="refresh">`.
- **Loading state for every fetch.** Replace the root with `<div class="loading">Loading…</div>` while waiting.
- **Errors degrade gracefully.** Show the error in a `.error` block; don't crash the sidebar.
- **External links open in new tabs.** Sidebars don't navigate (`<base target="_top">` already handles this).

## Wiring it up

In your add-on's `Code.js`:

```js
function showSidebar() {
  const ui = HtmlService.createTemplateFromFile('Sidebar')
    .evaluate()
    .setTitle('TakumiForm — <Add-on>');
  FormApp.getUi().showSidebar(ui);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
```

In your add-on's `Sidebar.html`:

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
      // ...your sidebar logic, using the components above
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
