const FEATURE = 'payments';
const TITLE = 'Take payments inside your form';
const TAGLINE = 'Stripe, your account. Auto totals from answers, quantity math, refunds from the response inbox.';

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
