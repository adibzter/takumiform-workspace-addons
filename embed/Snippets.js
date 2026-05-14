const FEATURE = 'embed';

function scriptSnippet(formId) {
  return (
    '<div data-takumiform="' + formId + '"></div>\n' +
    '<script src="' + CDN_URL + '" async></script>'
  );
}

function reactSnippet(formId) {
  return (
    "import { TakumiForm } from '" + NPM_PKG + "'\n\n" +
    '<TakumiForm formId="' + formId + '" />'
  );
}

function reactInstall() {
  return 'npm i ' + NPM_PKG;
}

function iframeSnippet(formId) {
  return (
    '<iframe src="' + APP_BASE + '/f/' + formId + '"\n' +
    '  width="100%" height="600" frameborder="0"></iframe>'
  );
}

function editorUrl(formId) {
  return APP_BASE + '/app?form=' + encodeURIComponent(formId) + '&feature=' + FEATURE;
}
