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

// `publish=true` opts in to publishing the form on Google during the
// import on the web app side (the add-on doesn't call Forms write APIs
// itself — that scope lives on the web app). The welcome screen sends
// this whenever the user leaves the auto-publish checkbox checked.
function connectUrl(formId, publish) {
  var url = APP_BASE + '/app?form=' + encodeURIComponent(formId) + '&feature=' + FEATURE;
  return publish ? url + '&publish=1' : url;
}

function syncUrl(formId) {
  return APP_BASE + '/app?form=' + encodeURIComponent(formId) + '&feature=' + FEATURE + '&sync=1';
}

function previewUrl(formId) {
  return APP_BASE + '/f/' + formId;
}

function statusUrl(formId) {
  return APP_BASE + '/api/forms/status?formId=' + encodeURIComponent(formId);
}
