# TakumiForm — Google Workspace Add-ons

Five separate Google Forms add-ons, one per Marketplace listing keyword. The "one product per keyword" strategy mirrors how Formfacade ships 6+ Marketplace listings.

| Folder | Marketplace listing | Tier |
| --- | --- | --- |
| [customize/](customize/) | "Customize Google Forms" | 1 |
| [embed/](embed/) | "Embed Google Forms" | 1 |
| [file-upload/](file-upload/) | "Google Forms File Upload (No Login)" | 1 |
| [payments/](payments/) | "Google Forms Payments" | 2 |
| [quiz-scoring/](quiz-scoring/) | "Google Forms Quiz Scoring" | 2 |

All add-ons share one backend (TakumiForm) — the add-on is the install funnel and the editor entry point. The actual customization, embed snippet, and response handling happen on `takumiform.com`.

## Stack

Each add-on is an [Apps Script](https://developers.google.com/apps-script) project deployed with [clasp](https://github.com/google/clasp). Cards use the [Card Service](https://developers.google.com/apps-script/add-ons/concepts/cards) so the same UI works in the Forms sidebar.

## Per-add-on layout

```
<addon>/
├── appsscript.json     manifest (scopes, homepage triggers)
├── Code.js             entry points: onHomepage, onFileScopeGranted
├── Ui.js               card builders
└── .clasp.json.example copy to .clasp.json with your scriptId
```

## Working on an add-on

```
npm i -g @google/clasp
clasp login
cd customize
cp .clasp.json.example .clasp.json   # then paste your scriptId
clasp push
clasp open                            # opens the Apps Script editor
```

To create a fresh script bound to nothing:

```
clasp create --type standalone --title "TakumiForm — Customize"
```

Then install the add-on against your account from the Apps Script editor → Deploy → Test deployments.

## Shared constants

Every add-on links back to `https://takumiform.com/app?form=<formId>&feature=<slug>`. The `feature` slug determines which editor opens (theme, embed, uploads, payments, scoring).
