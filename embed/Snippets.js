const FEATURE = 'embed';

// Embed snippet output is formatted to match how a human would write it:
// leading comment so the user can find it in their source later, one
// attribute per line on the iframe variant, two-space indentation.
function scriptSnippet(formId) {
  return [
    '<!-- TakumiForm embed -->',
    '<div data-takumiform="' + formId + '"></div>',
    '<script src="' + CDN_URL + '" async></script>',
  ].join('\n');
}

function iframeSnippet(formId) {
  return [
    '<!-- TakumiForm embed (iframe fallback) -->',
    '<iframe',
    '  src="' + APP_BASE + '/f/' + formId + '"',
    '  title="TakumiForm"',
    '  width="100%"',
    '  height="600"',
    '  frameborder="0"',
    '></iframe>',
  ].join('\n');
}

// The add-on does its own publishing via REST (see publishActiveForm in
// Code.js), so the connect URL stays simple — the web app just imports
// the schema. No publish flag needed in the URL.
function connectUrl(formId) {
  return APP_BASE + '/app?form=' + encodeURIComponent(formId) + '&feature=' + FEATURE;
}

// Server endpoint for in-place syncing — the modal now triggers this
// from Apps Script via UrlFetchApp so there's no redirect into the web
// app. Kept as a helper for clarity even though it's a single URL.
function addonSyncUrl(formId) {
  return APP_BASE + '/api/forms/addon-sync';
}

function previewUrl(formId) {
  return APP_BASE + '/f/' + formId;
}

// Deep-links straight into the theme editor for this form. The web app's
// /app entry resolves the Google form ID to the local row and 302s to
// /app/forms/<localId>/customize, so the add-on never has to know the
// local ID.
function customizeUrl(formId) {
  return APP_BASE + '/app?form=' + encodeURIComponent(formId) + '&feature=customize';
}

function statusUrl(formId) {
  return APP_BASE + '/api/forms/status?formId=' + encodeURIComponent(formId);
}
