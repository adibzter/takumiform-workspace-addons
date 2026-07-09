// Both constants point at production. `embed.js` is served from the
// same Astro app, no separate cdn. subdomain in the plan.
const APP_BASE = 'https://takumiform.com';
const CDN_URL = 'https://takumiform.com/embed.js';

function onOpen(e) {
  FormApp.getUi()
    .createAddonMenu()
    .addItem('Get embed code', 'showModal')
    .addToUi();
}

function onInstall(e) {
  onOpen(e);
}

// Modal (not sidebar) — chosen for higher attention on first run and
// because the user only opens the add-on briefly to grab the snippet,
// then closes it. Persistence-while-editing (sidebar's main advantage)
// isn't useful here. See ../STYLEGUIDE.md for the broader rationale.
function showModal() {
  // 560×500 fits both states (welcome + connected) without extra
  // bottom whitespace. Apps Script can't resize after open, so we
  // pick one size that works for both.
  const html = HtmlService.createTemplateFromFile('Modal')
    .evaluate()
    .setWidth(560)
    .setHeight(500);
  FormApp.getUi().showModalDialog(html, 'TakumiForm - Embed in Website');
}

// Used by Modal.html via `<?!= include('Stylesheet') ?>` to inline the
// shared CSS at render time. Keeps Stylesheet.html as a single source of
// truth for the add-on's design tokens and component styles.
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Single data fetch for the modal UI. Also checks whether the form is
// already connected to TakumiForm so the modal can render the right
// state — disconnected (welcome + Connect CTA) or connected (the snippet
// and supporting actions).
//
// When connected, we fire a background sync against /api/forms/addon-sync
// so the dashboard reflects the latest form structure by the time the
// user clicks through. The sync is fire-and-forget: failures are logged
// but never surfaced in the modal, because there's nothing the user can
// do from here to fix a sync failure — switching tabs to the dashboard
// would just re-trigger sync via the auto-refresh path. Centralizing
// sync in the web app also means the four scaffolded add-ons don't each
// need their own sync UI.
function getEmbedData() {
  const form = FormApp.getActiveForm();
  const formId = form.getId();
  const status = fetchStatus(formId);
  // Always push the schema, connected or not. If connected → updates the
  // existing forms row. If not connected → stashes payload in a stage
  // cache that /dashboard?form=<id> picks up after sign-in. Either way,
  // the web app no longer needs a Google scope to fetch this — the
  // add-on is the source of truth.
  triggerSchemaPush(form);
  return {
    formId: formId,
    title: form.getTitle() || 'Untitled form',
    connected: status.connected,
    script: scriptSnippet(formId),
    iframe: iframeSnippet(formId),
    connectUrl: connectUrl(formId),
    previewUrl: previewUrl(formId),
    customizeUrl: customizeUrl(formId)
  };
}

// POST the serialized form to /api/forms/addon-sync. Used both on
// modal open (fire-and-forget — the initial render doesn't wait for
// it) and via `resyncNow()` below (where the modal does want a yes/no
// outcome so the status pill can flip to "failed" on error).
//
// Returns { ok: boolean, error?: string }. Errors are still logged to
// Stackdriver so we don't lose the diagnostic.
function triggerSchemaPush(form) {
  try {
    var payload = buildSyncPayload(form);
    var res = UrlFetchApp.fetch(addonSyncUrl(form.getId()), {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    var code = res.getResponseCode();
    if (code < 200 || code >= 300) {
      console.error('addon-sync non-2xx:', code, res.getContentText());
      return { ok: false, error: 'HTTP ' + code };
    }
    return { ok: true };
  } catch (e) {
    console.error('addon-sync trigger failed:', e && e.message);
    return { ok: false, error: (e && e.message) || 'request-failed' };
  }
}

// Called by Modal.html when the user clicks the "Sync now" link. We
// re-serialize the form (it may have changed since the modal opened)
// and push it. Returns the same shape as triggerSchemaPush so the
// modal can paint success or failure without translating.
function resyncNow() {
  return triggerSchemaPush(FormApp.getActiveForm());
}

// Lightweight poll target for the modal's disconnected state. Returns
// { connected: bool } and nothing else — crucially it does NOT push the
// schema (unlike getEmbedData), so the modal can call it every few
// seconds while the user finishes connecting in the other tab without
// hammering /api/forms/addon-sync. Once it flips to connected, the modal
// makes a single getEmbedData() call to load the full connected view.
function checkConnection() {
  return fetchStatus(FormApp.getActiveForm().getId());
}

// Returns { connected: bool } from our server. Used on modal load and by
// the "Refresh" link after the user has connected in a separate tab.
function fetchStatus(formId) {
  try {
    const res = UrlFetchApp.fetch(statusUrl(formId), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return { connected: false };
    return JSON.parse(res.getContentText());
  } catch (e) {
    return { connected: false };
  }
}
