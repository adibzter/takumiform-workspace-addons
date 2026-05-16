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
function getEmbedData() {
  const form = FormApp.getActiveForm();
  const formId = form.getId();
  const status = fetchStatus(formId);
  return {
    formId: formId,
    title: form.getTitle() || 'Untitled form',
    connected: status.connected,
    updatedAt: status.updatedAt || null,
    script: scriptSnippet(formId),
    iframe: iframeSnippet(formId),
    connectUrl: connectUrl(formId),
    previewUrl: previewUrl(formId),
    customizeUrl: customizeUrl(formId)
  };
}

// Inline re-sync. Called by the Sync button in Modal.html via
// google.script.run, so the user gets a status update without bouncing
// through a new browser tab into /dashboard. Returns the same {connected,
// updatedAt} shape the modal already knows how to render. On failure the
// modal surfaces an inline error instead of silently leaving stale info.
function syncForm() {
  const formId = FormApp.getActiveForm().getId();
  try {
    const res = UrlFetchApp.fetch(addonSyncUrl(formId), {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: 'formId=' + encodeURIComponent(formId),
      muteHttpExceptions: true,
    });
    const code = res.getResponseCode();
    const body = JSON.parse(res.getContentText() || '{}');
    if (code >= 200 && code < 300 && body.ok) {
      return { ok: true, connected: true, updatedAt: body.updatedAt };
    }
    return { ok: false, error: body.error || ('HTTP ' + code) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Publishes the active form using the 2024 Forms publish workflow.
// Apps Script's FormApp class doesn't expose this — it's REST-only —
// so we call setPublishSettings directly with the script's OAuth token.
//
// Requires `forms.body` in appsscript.json (forms.currentonly alone
// scopes FormApp access, not REST). The user is already an editor of
// the form (otherwise FormApp.getActiveForm() wouldn't have returned
// it), so we don't need to add ourselves as editor — the OAuth token
// acts as them.
//
// Fires on modal open from Modal.html so the form is published by the
// time the user lands on the dashboard. Idempotent: re-opening on an
// already-published form is a cheap no-op on the API side.
//
// Returns {ok: true, code} on success, {ok: false, code?, error} on
// failure so the client can surface the issue inline.
function publishActiveForm() {
  try {
    const form = FormApp.getActiveForm();
    const formId = form.getId();
    const res = UrlFetchApp.fetch(
      'https://forms.googleapis.com/v1/forms/' + encodeURIComponent(formId) + ':setPublishSettings',
      {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        payload: JSON.stringify({
          publishSettings: {
            publishState: { isPublished: true, isAcceptingResponses: true }
          }
        }),
        muteHttpExceptions: true,
      }
    );
    const code = res.getResponseCode();
    if (code >= 200 && code < 300) return { ok: true, code: code };
    const body = res.getContentText();
    Logger.log('publishActiveForm failed: code=' + code + ' body=' + body.slice(0, 500));
    return { ok: false, code: code, error: body.slice(0, 500) };
  } catch (e) {
    Logger.log('publishActiveForm exception: ' + e.message);
    return { ok: false, error: e.message };
  }
}

// Returns { connected: bool, updatedAt?: number } from our server. Used
// on modal load and by the "Refresh" link after the user has connected
// or synced in a separate tab.
function fetchStatus(formId) {
  try {
    const res = UrlFetchApp.fetch(statusUrl(formId), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return { connected: false };
    return JSON.parse(res.getContentText());
  } catch (e) {
    return { connected: false };
  }
}
