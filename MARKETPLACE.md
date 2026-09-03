# Marketplace listing copy (next version)

The copy for the next update of the published listing. Renaming or re-scoping
the live listing triggers a Google update review, so everything here ships as
one batch. Two kinds of surface, with different release mechanics:

- **Listing surfaces** (Marketplace SDK console): change only when the review
  is filed. Sections 1 to 4.
- **Code surfaces** (menu, modal): shipped by `clasp push`, no review. Can go
  out ahead of the listing. Sections 5 to 7.

House copy rules apply throughout (see ../takumiform/CLAUDE.md → Copy
guidelines): no em-dashes or en-dashes, no AI-tell vocabulary, no parallel
triplet sentences, concrete over benefit-speak. Name only shipped features;
Google devalues listings that advertise what users can't do today.

## 1. App name (50 char limit)

> TakumiForm: Customize, Embed, File Upload, Quiz

(48 chars.) Covers four target keywords with only live features. When
Payments ships, the limit is full — move the lowest-volume keyword to the
short description in that batch; "customize" is the highest-volume keyword
and stays.

## 2. Short description (200 char limit)

> Restyle your Google Form, embed it on any website, accept file uploads with
> no Google sign-in, and auto-grade quizzes with instant scores. Responses
> keep landing in your Google Sheet.

(185 chars.)

## 3. Detailed description

> TakumiForm makes your Google Form look like part of your site and adds the
> things Forms won't do on its own.
>
> **Customize**: colors, fonts, button style, corner radius, and your logo.
> Upload a logo and we read your brand colors out of it. Save a look as a
> template and reuse it on every form.
>
> **Embed**: one snippet, any host. Webflow, WordPress, Squarespace, Framer,
> plain HTML. No iframe wall, no Google branding, and the embed picks up your
> edits automatically when you change the form in Google.
>
> **File upload**: let respondents attach files without signing in to Google.
> You set the size limits and allowed types; files arrive in your TakumiForm
> dashboard, private to you.
>
> **Quiz scoring**: auto-grade quiz answers using your form's answer key and,
> if you choose, show respondents their score the moment they submit, with
> your own pass and fail messages.
>
> Your form stays a Google Form. Responses keep flowing into the same Google
> Sheet you already use, through Google's own pipeline.
>
> **How it works**
> 1. Install the add-on, then open it from your form's Extensions menu.
> 2. Click Connect to TakumiForm and sign in with the account that owns the
>    form.
> 3. Copy the snippet onto your site, or share your form's takumiform.com
>    link directly.
>
> The add-on only reads the single form you open it in. Everything is free
> for 7 days from your first sign-in, no credit card needed up front. After
> that, one plan (Takumi Starter, Pro, or Business) includes every feature;
> the tiers just differ by volume.
>
> Questions? support@pawakalabs.com

## 4. Other listing fields

- **Category**: Web Development (unchanged).
- **Pricing designation**: Paid with free trial.
- **Support links** (unchanged, keep reachable): https://takumiform.com/support,
  https://takumiform.com/privacy, https://takumiform.com/terms.
- **Screenshots to reshoot for this version** (1280×800):
  1. The modal's connected view with the embed snippet.
  2. The customize editor with a branded form in the live preview.
  3. A rendered form on a third-party site (the before/after shot if we have it).
  4. An upload field on a rendered form ("Attach your resume", no sign-in).
  5. The responses inbox showing a file download link column.
  6. The thank-you screen showing "Your score: X / Y" with a pass message.
- **Consent screen app name stays "TakumiForm"** — it's already verified;
  don't touch it, the listing name and the OAuth brand are separate things.

## 5. Extensions menu (Code.js `onOpen`, clasp push)

One item, feature-neutral now that the modal is the hub for everything:

> Open TakumiForm

(Replaces "Get embed code". The menu's parent label comes from the listing
name, not from code.)

## 6. Modal dialog title (Code.js `showModal`)

> TakumiForm

(Replaces "TakumiForm - Embed in Website". The dialog chrome is small; the
short name reads better and won't go stale as features ship.)

## 7. Modal copy (Modal.html, clasp push)

Disconnected (welcome) state:

- Headline: "Do more with this form" (replaces "Embed this form on your site")
- Bullets (replaces the current four):
  - "Embed it on Webflow, WordPress, any site"
  - "Match your colors, fonts, and logo"
  - "Accept file uploads, no Google sign-in needed"
  - "Auto-grade quizzes with instant scores"
  - "Auto-syncs when you edit the form"
- CTA button: "Connect to TakumiForm" (unchanged)
- Under the CTA: "Free for 7 days from first sign-in. No card needed."
- Waiting state: "Waiting for you to connect…" / "Refresh now" (unchanged)

Connected state:

- Status pill: "Connected" / "Synced just now" / "Sync now" (unchanged)
- Section heading: "Embed snippet" (unchanged)
- Action links: "Preview" · "Customize" · "File upload" (adds the third)
- "Iframe option (no JavaScript)" (unchanged)

Engineering note for the "File upload" link: it should deep-link to
`/dashboard?form=<id>&feature=file-upload`. The web app currently routes
`feature=customize` to the customize tab and everything else to the
dashboard; teach it to route `file-upload` to
`/dashboard/forms/<localId>/uploads` before shipping this link.

## Out of scope for this batch

- Payments, WhatsApp: not shipped, so not named anywhere.
- appsscript.json needs no changes (scopes stay `forms.currentonly`,
  `script.container.ui`, `script.external_request` — keep the verification
  bar low).
