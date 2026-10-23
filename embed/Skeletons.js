// Form skeletons: the structure a site vertical starts from. The web app
// serves them as JSON; this file fetches one and writes its items into the
// owner's own form with FormApp, under the forms.currentonly scope the
// add-on already holds. Code.js exposes applySkeleton() and listSkeletons()
// to the modal and calls into here.

// Mirrors isSkeletonId in the web app, so a bad id never becomes a URL.
var SKELETON_ID = /^[a-z0-9-]{3,40}$/;

// Returns { ok: true, skeletons: [{ id, vertical, name }] } or { ok: false, error }.
function fetchSkeletonIndex() {
  var res = fetchJson(skeletonIndexUrl());
  if (!res.ok) return res;
  var skeletons = res.json && res.json.skeletons;
  if (!Array.isArray(skeletons)) return { ok: false, error: 'bad-response' };
  return { ok: true, skeletons: skeletons };
}

// Returns { ok: true, skeleton: { id, vertical, name, items } } or { ok: false, error }.
function fetchSkeleton(skeletonId) {
  if (!SKELETON_ID.test(String(skeletonId))) return { ok: false, error: 'bad-id' };
  var res = fetchJson(skeletonUrl(skeletonId));
  if (!res.ok) return res;
  var items = res.json && res.json.items;
  if (!Array.isArray(items)) return { ok: false, error: 'bad-response' };
  return { ok: true, skeleton: res.json };
}

// GET, 2xx check, JSON.parse. Each failure is reported rather than thrown
// so the modal gets a short reason instead of a stack trace.
function fetchJson(url) {
  var res;
  try {
    res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  } catch (e) {
    console.error('skeleton fetch failed:', url, e && e.message);
    return { ok: false, error: 'request-failed' };
  }
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    console.error('skeleton non-2xx:', code, url);
    return { ok: false, error: 'HTTP ' + code };
  }
  try {
    return { ok: true, json: JSON.parse(res.getContentText()) };
  } catch (e) {
    console.error('skeleton bad JSON:', url, e && e.message);
    return { ok: false, error: 'bad-json' };
  }
}

// Adds one skeleton item to the form. Returns true when an item was added,
// false when it was skipped (unknown type, sample image unavailable, or
// FormApp refused it). The optional setters are guarded one by one: an
// item that exists with a missing help text is better than no item, while
// a failed add leaves nothing behind to clean up.
function addSkeletonItem(form, item) {
  var type = item && item.type;
  var title = String((item && item.title) || '');
  var description = String((item && item.description) || '');
  try {
    if (type === 'section') {
      var pageBreak = form.addPageBreakItem().setTitle(title);
      if (description) trySet(function () { pageBreak.setHelpText(description); });
      return true;
    }
    if (type === 'text') {
      var header = form.addSectionHeaderItem().setTitle(title);
      if (description) trySet(function () { header.setHelpText(description); });
      return true;
    }
    if (type === 'image') {
      // Fetch before adding, so a missing sample leaves no empty image item.
      var blob = fetchSampleBlob(item.sample);
      if (!blob) return false;
      form.addImageItem().setImage(blob).setTitle(title);
      return true;
    }
    if (type === 'choice') {
      var options = Array.isArray(item.options) ? item.options.map(String) : [];
      if (options.length === 0) return false;
      var choiceItem = item.choice === 'many' ? form.addCheckboxItem() : form.addMultipleChoiceItem();
      choiceItem.setTitle(title).setChoiceValues(options);
      if (description) trySet(function () { choiceItem.setHelpText(description); });
      if (item.required) trySet(function () { choiceItem.setRequired(true); });
      return true;
    }
    if (type === 'short') {
      var textItem = form.addTextItem().setTitle(title);
      if (description) trySet(function () { textItem.setHelpText(description); });
      if (item.required) trySet(function () { textItem.setRequired(true); });
      if (item.validation === 'phone' || item.validation === 'email') {
        trySet(function () { textItem.setValidation(textValidation(item.validation)); });
      }
      return true;
    }
    if (type === 'paragraph') {
      var paragraph = form.addParagraphTextItem().setTitle(title);
      if (description) trySet(function () { paragraph.setHelpText(description); });
      if (item.required) trySet(function () { paragraph.setRequired(true); });
      return true;
    }
    if (type === 'date') {
      var date = form.addDateItem().setTitle(title);
      if (item.required) trySet(function () { date.setRequired(true); });
      return true;
    }
    if (type === 'time') {
      var time = form.addTimeItem().setTitle(title);
      if (item.required) trySet(function () { time.setRequired(true); });
      return true;
    }
    console.error('skeleton: unknown item type', type);
    return false;
  } catch (e) {
    console.error('skeleton: could not add item', type, title, e && e.message);
    return false;
  }
}

// 'phone' is a loose international pattern: a leading + or digit, then at
// least six digits, spaces, parentheses or dashes. Google evaluates it with
// RE2, so it stays on plain character classes. 'email' uses Google's own
// email check.
function textValidation(kind) {
  var builder = FormApp.createTextValidation();
  if (kind === 'email') {
    return builder.requireTextIsEmail().setHelpText('Enter an email address').build();
  }
  return builder
    .requireTextMatchesPattern('^[+0-9][0-9 ()-]{6,}$')
    .setHelpText('Enter a phone number')
    .build();
}

// Samples are plain paths on our origin ("/samples/...", under 500 KB).
// Anything else is refused: the add-on never fetches a URL an arbitrary
// JSON file points it at.
function fetchSampleBlob(sample) {
  if (typeof sample !== 'string' || sample.charAt(0) !== '/' || sample.indexOf('//') === 0) {
    console.error('skeleton: bad sample path', sample);
    return null;
  }
  try {
    var res = UrlFetchApp.fetch(APP_BASE + sample, { muteHttpExceptions: true });
    var code = res.getResponseCode();
    if (code < 200 || code >= 300) {
      console.error('skeleton sample non-2xx:', code, sample);
      return null;
    }
    return res.getBlob();
  } catch (e) {
    console.error('skeleton sample fetch failed:', sample, e && e.message);
    return null;
  }
}

function trySet(fn) {
  try { fn(); } catch (e) { console.error('skeleton: setter failed', e && e.message); }
}
