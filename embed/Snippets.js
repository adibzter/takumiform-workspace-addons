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

// The add-on publishes the form itself (see publishActiveForm in
// Code.js), so the connect URL stays simple — the web app just imports
// the schema. No publish flag needed in the URL.
function connectUrl(formId) {
  return APP_BASE + '/dashboard?form=' + encodeURIComponent(formId) + '&feature=' + FEATURE;
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
// /dashboard entry resolves the Google form ID to the local row and 302s to
// /dashboard/forms/<localId>/customize, so the add-on never has to know the
// local ID.
function customizeUrl(formId) {
  return APP_BASE + '/dashboard?form=' + encodeURIComponent(formId) + '&feature=customize';
}

function statusUrl(formId) {
  return APP_BASE + '/api/forms/status?formId=' + encodeURIComponent(formId);
}

// Build the payload the web app's /api/forms/addon-sync expects. The
// web app no longer fetches schemas from the Forms REST API itself
// (verification reasons — see takumiform/CLAUDE.md), so the add-on is
// the source of truth for what the form looks like. We mirror the
// shape of the REST Form resource closely enough that the renderer and
// submit pipeline can keep parsing schema_json the same way.
function buildSyncPayload(form) {
  var items = form.getItems();
  var serializedItems = [];
  var questionIds = [];
  var pageCount = 1;
  var isQuiz = !!safeGet(function () { return form.isQuiz(); });

  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var serialized = serializeItem(it, isQuiz);
    if (!serialized) continue;
    serializedItems.push(serialized.json);
    if (serialized.type === 'pageBreak') {
      pageCount++;
    } else if (serialized.type === 'group') {
      for (var r = 0; r < serialized.rowIds.length; r++) {
        questionIds.push(serialized.rowIds[r]);
      }
    } else if (serialized.questionId) {
      questionIds.push(serialized.questionId);
    }
  }

  var destinationId = null;
  try {
    if (form.getDestinationType() === FormApp.DestinationType.SPREADSHEET) {
      destinationId = form.getDestinationId();
    }
  } catch (_) { /* no destination set */ }

  var responderUri = null;
  try { responderUri = form.getPublishedUrl(); } catch (_) { /* form not published */ }

  return {
    formId: form.getId(),
    schema: {
      formId: form.getId(),
      isQuiz: isQuiz,
      info: {
        title: form.getTitle() || '',
        description: form.getDescription() || '',
      },
      items: serializedItems,
      publishSettings: {
        publishState: {
          isPublished: readIsPublished(form),
          isAcceptingResponses: !!form.isAcceptingResponses(),
        },
      },
    },
    linkedSheetId: destinationId,
    responderUri: responderUri,
    questionIds: questionIds,
    pageCount: pageCount,
  };
}

// True publish state, or true for forms too old to have one. isPublished()
// throws on those, and the renderer's own isPublished() treats a missing
// publishState the same way — accepting-responses is the only real signal
// there, and it's reported separately.
function readIsPublished(form) {
  try {
    if (!form.supportsAdvancedResponderPermissions()) return true;
    return !!form.isPublished();
  } catch (_) {
    return true;
  }
}

// Quiz grading for a choice-based item: points plus the values marked
// correct. Only read when the form is a quiz. Everything is guarded —
// getPoints()/isCorrectAnswer() exist on quiz-capable items but this code
// may run against old runtimes or item states that throw. Returns null
// when there's nothing gradable, so non-quiz payloads are byte-identical
// to before. Short answer is deliberately absent: FormApp doesn't expose
// text correct answers, so those stay manually graded (as on Google).
function choiceGrading(typedItem, choiceArr) {
  var points = safeGet(function () { return typedItem.getPoints(); });
  var correct = [];
  for (var i = 0; i < choiceArr.length; i++) {
    if (safeGet(function () { return choiceArr[i].isCorrectAnswer(); })) {
      correct.push(choiceArr[i].getValue());
    }
  }
  if (!points && correct.length === 0) return null;
  return { points: points || 0, correctValues: correct };
}

// Convert one FormApp Item to the REST-shaped JSON the renderer expects.
// Returns `{ json, type, questionId?, rowIds? }` or null when the item
// type isn't one we render (we ship it through as a textItem placeholder
// so the renderer doesn't drop everything below it).
// `isQuiz` gates the per-question `grading` block (points + correct
// values). That block is consumed server-side by the web app's scoring —
// the renderer never prints it into HTML.
function serializeItem(item, isQuiz) {
  var T = FormApp.ItemType;
  var base = {
    itemId: String(item.getId()),
    title: item.getTitle() || '',
    description: item.getHelpText() || '',
  };
  var t = item.getType();
  var qid = String(item.getId());

  if (t === T.PAGE_BREAK) {
    return { json: Object.assign({}, base, { pageBreakItem: {} }), type: 'pageBreak' };
  }
  if (t === T.SECTION_HEADER) {
    return { json: Object.assign({}, base, { textItem: {} }), type: 'text' };
  }
  if (t === T.IMAGE) {
    return { json: Object.assign({}, base, { imageItem: {} }), type: 'image' };
  }
  if (t === T.VIDEO) {
    var v = item.asVideoItem();
    return {
      json: Object.assign({}, base, {
        videoItem: { video: { youtubeUri: safeGet(function () { return v.getVideoUrl(); }) } },
      }),
      type: 'video',
    };
  }
  if (t === T.TEXT) {
    var txt = item.asTextItem();
    return {
      json: Object.assign({}, base, {
        questionItem: {
          question: { questionId: qid, required: !!txt.isRequired(), textQuestion: {} },
        },
      }),
      type: 'question',
      questionId: qid,
    };
  }
  if (t === T.PARAGRAPH_TEXT) {
    var p = item.asParagraphTextItem();
    return {
      json: Object.assign({}, base, {
        questionItem: {
          question: { questionId: qid, required: !!p.isRequired(), textQuestion: { paragraph: true } },
        },
      }),
      type: 'question',
      questionId: qid,
    };
  }
  if (t === T.MULTIPLE_CHOICE || t === T.CHECKBOX || t === T.LIST) {
    var choiceType = t === T.MULTIPLE_CHOICE ? 'RADIO' : (t === T.CHECKBOX ? 'CHECKBOX' : 'DROP_DOWN');
    var typed = t === T.MULTIPLE_CHOICE ? item.asMultipleChoiceItem()
              : t === T.CHECKBOX ? item.asCheckboxItem()
              : item.asListItem();
    var choiceArr = typed.getChoices();
    var question = {
      questionId: qid,
      required: !!typed.isRequired(),
      choiceQuestion: { type: choiceType, options: choices(choiceArr) },
    };
    if (isQuiz) {
      var grading = choiceGrading(typed, choiceArr);
      if (grading) question.grading = grading;
    }
    return {
      json: Object.assign({}, base, { questionItem: { question: question } }),
      type: 'question',
      questionId: qid,
    };
  }
  if (t === T.SCALE) {
    var sc = item.asScaleItem();
    return {
      json: Object.assign({}, base, {
        questionItem: {
          question: {
            questionId: qid,
            required: !!sc.isRequired(),
            scaleQuestion: {
              low: sc.getLowerBound(),
              high: sc.getUpperBound(),
              lowLabel: sc.getLeftLabel() || '',
              highLabel: sc.getRightLabel() || '',
            },
          },
        },
      }),
      type: 'question',
      questionId: qid,
    };
  }
  // T.RATING is guarded because RatingItem is a 2025 FormApp addition —
  // if Google's runtime predates it the comparison is just false and the
  // item falls through to the textItem placeholder like before.
  if (T.RATING && t === T.RATING) {
    var rat = item.asRatingItem();
    return {
      json: Object.assign({}, base, {
        questionItem: {
          question: {
            questionId: qid,
            required: !!rat.isRequired(),
            ratingQuestion: {
              ratingScaleLevel: rat.getRatingScaleLevel(),
              iconType: String(safeGet(function () { return rat.getRatingIcon(); }) || 'STAR'),
            },
          },
        },
      }),
      type: 'question',
      questionId: qid,
    };
  }
  if (t === T.DATE) {
    var d = item.asDateItem();
    return {
      json: Object.assign({}, base, {
        questionItem: {
          question: {
            questionId: qid,
            required: !!d.isRequired(),
            dateQuestion: { includeYear: !!d.includesYear() },
          },
        },
      }),
      type: 'question',
      questionId: qid,
    };
  }
  if (t === T.DATETIME) {
    var dt = item.asDateTimeItem();
    return {
      json: Object.assign({}, base, {
        questionItem: {
          question: {
            questionId: qid,
            required: !!dt.isRequired(),
            dateQuestion: { includeYear: !!dt.includesYear(), includeTime: true },
          },
        },
      }),
      type: 'question',
      questionId: qid,
    };
  }
  if (t === T.TIME) {
    var tm = item.asTimeItem();
    return {
      json: Object.assign({}, base, {
        questionItem: {
          question: { questionId: qid, required: !!tm.isRequired(), timeQuestion: {} },
        },
      }),
      type: 'question',
      questionId: qid,
    };
  }
  if (t === T.DURATION) {
    var du = item.asDurationItem();
    return {
      json: Object.assign({}, base, {
        questionItem: {
          question: { questionId: qid, required: !!du.isRequired(), timeQuestion: { duration: true } },
        },
      }),
      type: 'question',
      questionId: qid,
    };
  }
  if (t === T.GRID || t === T.CHECKBOX_GRID) {
    var isCheckboxGrid = (t === T.CHECKBOX_GRID);
    var g = isCheckboxGrid ? item.asCheckboxGridItem() : item.asGridItem();
    var rows = g.getRows();
    var cols = g.getColumns();
    var rowIds = [];
    var subQuestions = [];
    for (var r = 0; r < rows.length; r++) {
      var rid = qid + '-r' + r;
      rowIds.push(rid);
      subQuestions.push({
        questionId: rid,
        rowQuestion: { title: rows[r] },
        required: !!g.isRequired(),
      });
    }
    return {
      json: Object.assign({}, base, {
        questionGroupItem: {
          questions: subQuestions,
          grid: {
            columns: {
              type: isCheckboxGrid ? 'CHECKBOX' : 'RADIO',
              options: cols.map(function (c) { return { value: c }; }),
            },
          },
        },
      }),
      type: 'group',
      rowIds: rowIds,
    };
  }

  // Unknown / unsupported (file upload, etc.) — render as a no-op text
  // item so the form still loads instead of erroring on parse.
  return {
    json: Object.assign({}, base, { textItem: {} }),
    type: 'text',
  };
}

function choices(arr) {
  var out = [];
  for (var i = 0; i < arr.length; i++) out.push({ value: arr[i].getValue() });
  return out;
}

function safeGet(fn) { try { return fn(); } catch (_) { return null; } }
