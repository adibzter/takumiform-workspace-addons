const FEATURE = 'uploads';
const TITLE = 'Accept file uploads, no Google login';
const TAGLINE = 'Anonymous respondents can upload files. Configurable size limits, type whitelist, virus scan, links land in your Sheet.';

function onHomepage(e) {
  return buildIntroCard();
}

function onFormsHomepage(e) {
  if (!e || !e.formsAddOnEventObject || !e.formsAddOnEventObject.formId) {
    return buildIntroCard();
  }
  return buildEditorCard(e.formsAddOnEventObject.formId);
}

function onFileScopeGranted(e) {
  return buildEditorCard(e.formsAddOnEventObject.formId);
}
