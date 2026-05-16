const FEATURE = 'embed';

function scriptSnippet(formId) {
  return (
    '<div data-takumiform="' + formId + '"></div>\n' +
    '<script src="' + CDN_URL + '" async></script>'
  );
}

function iframeSnippet(formId) {
  return (
    '<iframe src="' + APP_BASE + '/f/' + formId + '"\n' +
    '  width="100%" height="600" frameborder="0"></iframe>'
  );
}

// The add-on does its own publishing via REST (see publishActiveForm in
// Code.js), so the connect URL stays simple — the web app just imports
// the schema. No publish flag needed in the URL.
function connectUrl(formId) {
  return APP_BASE + '/app?form=' + encodeURIComponent(formId) + '&feature=' + FEATURE;
}

function syncUrl(formId) {
  return APP_BASE + '/app?form=' + encodeURIComponent(formId) + '&feature=' + FEATURE + '&sync=1';
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
