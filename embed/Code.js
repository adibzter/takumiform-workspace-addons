// Both constants point at production. `embed.js` is served from the
// same Astro app, no separate cdn. subdomain in the plan.
const APP_BASE = 'https://takumiform.com';
const CDN_URL = 'https://takumiform.com/embed.js';

function onOpen(e) {
  FormApp.getUi()
    .createAddonMenu()
    .addItem('Open TakumiForm', 'showModal')
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
  FormApp.getUi().showModalDialog(html, 'TakumiForm');
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
  // Publish before pushing the schema so the payload reports the
  // post-publish state rather than the state we just changed.
  const publish = publishActiveForm(form);
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
    // 'form' or 'site'. Decides which connected state the modal paints.
    mode: status.mode,
    siteUrl: status.siteUrl,
    sitePublished: status.sitePublished,
    publish: publish,
    script: scriptSnippet(formId),
    iframe: iframeSnippet(formId),
    connectUrl: connectUrl(formId, 'embed'),
    connectSiteUrl: connectUrl(formId, 'site'),
    siteSettingsUrl: siteSettingsUrl(formId),
    previewUrl: previewUrl(formId),
    customizeUrl: customizeUrl(formId),
    uploadsUrl: uploadsUrl(formId)
  };
}

// Publishes the active form using the 2024 Forms publish workflow. A
// form has to be published before respondents can submit, and a user
// who embeds our snippet has clearly decided to collect responses — so
// we do it for them instead of leaving a "click Publish" instruction.
//
// This runs under `forms.currentonly`, the scope we already hold.
// FormApp gained setPublished()/isPublished() after the publish
// workflow shipped; before that this was REST-only and needed the
// sensitive `forms.body` scope, which is why an earlier version of
// this function was deleted. Nothing sensitive is needed now.
//
// Both methods throw on forms too old to support publishing, so the
// supportsAdvancedResponderPermissions() guard is required, not
// defensive. Those forms have no publish state at all — accepting
// responses is the whole story — which is why `unsupported` is a
// distinct outcome from `ok` and not an error.
//
// Returns { ok: true } | { ok: false, unsupported: true } |
// { ok: false, error }. The modal only interrupts the user on the
// last one.
function publishActiveForm(form) {
  try {
    if (!form.supportsAdvancedResponderPermissions()) {
      return { ok: false, unsupported: true };
    }
    if (!form.isPublished()) form.setPublished(true);
    return { ok: true };
  } catch (e) {
    console.error('auto-publish failed:', e && e.message);
    return { ok: false, error: (e && e.message) || 'publish-failed' };
  }
}

// POST the serialized form to /api/forms/addon-sync. Used both on
// modal open (fire-and-forget — the initial render doesn't wait for
// it) and via `resyncNow()` below (where the modal does want a yes/no
// outcome so the status pill can flip to "failed" on error).
//
// Returns { ok: boolean, error?: string }. Errors are still logged to
// Stackdriver so we don't lose the diagnostic.
//
// Image bytes never travel in the JSON body: the payload carries hashes,
// and the sync response lists the ones the web app is missing, which are
// uploaded afterwards. An image that fails to upload never fails the sync.
function triggerSchemaPush(form) {
  try {
    var payload = buildSyncPayload(form);
    var images = payload.images || {};
    delete payload.images;
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
    uploadMissingImages(form.getId(), images, res.getContentText());
    return { ok: true };
  } catch (e) {
    console.error('addon-sync trigger failed:', e && e.message);
    return { ok: false, error: (e && e.message) || 'request-failed' };
  }
}

// One multipart POST per image the sync response named in `missingImages`.
// Capped per push so a form with dozens of large images can't hold the
// modal open for minutes; whatever is left goes on the next sync, because
// the web app keeps asking until it has them all.
var MAX_IMAGE_UPLOADS_PER_PUSH = 20;

function uploadMissingImages(formId, images, syncResponseText) {
  var missing;
  try {
    missing = JSON.parse(syncResponseText).missingImages;
  } catch (_) {
    return;
  }
  if (!Array.isArray(missing) || missing.length === 0) return;

  var attempted = 0;
  for (var i = 0; i < missing.length && attempted < MAX_IMAGE_UPLOADS_PER_PUSH; i++) {
    var sha256 = missing[i];
    var blob = images[sha256];
    if (!blob) continue;
    attempted++;
    try {
      // A Blob value makes UrlFetchApp send multipart/form-data; the part
      // only arrives server-side as a file when the blob has a name.
      if (!blob.getName()) blob.setName(sha256);
      var res = UrlFetchApp.fetch(addonImageUrl(), {
        method: 'post',
        payload: { formId: formId, sha256: sha256, file: blob },
        muteHttpExceptions: true,
      });
      var code = res.getResponseCode();
      if (code < 200 || code >= 300) {
        console.error('addon-image non-2xx:', code, sha256, res.getContentText());
      }
    } catch (e) {
      console.error('addon-image upload failed:', sha256, e && e.message);
    }
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

// Reads the form's status from our server, normalized so the modal can
// branch without null checks: { connected, mode, siteUrl, sitePublished }.
// `mode` is 'form' or 'site'; a server that predates sites sends none,
// which reads as 'form'. Any failure reads as not connected.
function fetchStatus(formId) {
  var status = { connected: false, mode: 'form', siteUrl: null, sitePublished: false };
  try {
    var res = UrlFetchApp.fetch(statusUrl(formId), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return status;
    var body = JSON.parse(res.getContentText());
    status.connected = !!body.connected;
    status.mode = body.mode === 'site' ? 'site' : 'form';
    status.siteUrl = typeof body.siteUrl === 'string' && body.siteUrl ? body.siteUrl : null;
    status.sitePublished = !!body.sitePublished;
    return status;
  } catch (e) {
    return status;
  }
}

// Writes a form skeleton (a vertical's starting structure, served by the
// web app) into the active form, item by item. Refuses a form that already
// has items unless the modal confirmed appending, then pushes the schema
// so the dashboard sees the new structure. One bad item is logged and
// skipped, never fatal: a stray item is easy to delete in Forms, while a
// half-written skeleton behind an error is not. The FormApp mapping per
// item type lives in Skeletons.js.
//
// Returns { ok: true, added, skipped, connectSiteUrl } or { ok: false, error }
// where error is 'not-empty', 'bad-id', 'HTTP nnn', 'bad-json',
// 'bad-response' or 'request-failed'.
function applySkeleton(skeletonId, allowAppend) {
  var form = FormApp.getActiveForm();
  if (!allowAppend && form.getItems().length > 0) {
    return { ok: false, error: 'not-empty' };
  }
  var fetched = fetchSkeleton(skeletonId);
  if (!fetched.ok) return fetched;
  var items = fetched.skeleton.items;
  var added = 0;
  var skipped = 0;
  for (var i = 0; i < items.length; i++) {
    if (addSkeletonItem(form, items[i])) added++; else skipped++;
  }
  triggerSchemaPush(form);
  return {
    ok: true,
    added: added,
    skipped: skipped,
    // The site connect link now names the skeleton, so the web app can
    // pick the matching site template on first connect.
    connectSiteUrl: connectUrl(form.getId(), 'site', skeletonId),
  };
}

// Feeds the modal's template picker.
// Returns { ok: true, skeletons: [{ id, vertical, name }] } or { ok: false, error }.
function listSkeletons() {
  return fetchSkeletonIndex();
}
