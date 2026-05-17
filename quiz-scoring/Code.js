const FEATURE = 'scoring';
const TITLE = 'Smarter quizzes than Google gives you';
const TAGLINE = 'Weighted scoring, multi-step pages, pass/fail email triggers.';

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
