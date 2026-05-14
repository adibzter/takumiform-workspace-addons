const FEATURE = 'theme';
const TITLE = 'Customize this form';
const TAGLINE = 'Pick colors, fonts, logo. Strip the Google chrome. Live preview.';

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
