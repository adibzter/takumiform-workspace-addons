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
  FormApp.getUi().showModalDialog(html, 'TakumiForm — Embed');
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
  if (status.connected) triggerBackgroundSync(formId);
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

// Fire-and-forget POST to /api/forms/addon-sync. Errors are logged to
// Stackdriver only; the modal never blocks or paints on the result.
function triggerBackgroundSync(formId) {
  try {
    UrlFetchApp.fetch(addonSyncUrl(formId), {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: 'formId=' + encodeURIComponent(formId),
      muteHttpExceptions: true,
    });
  } catch (e) {
    console.error('addon-sync trigger failed:', e && e.message);
  }
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
