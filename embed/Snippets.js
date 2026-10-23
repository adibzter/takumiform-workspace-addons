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

// The connect deep link carries the mode the user picked on the welcome
// state: `embed` keeps the form a form, `site` makes the web app record it
// as a site on first connect and land on the Site tab. An optional
// skeleton id rides along on the site link once the modal has written a
// template into the form, so the web app can pick the matching site
// template. The add-on publishes the form itself (see publishActiveForm in
// Code.js), so no publish flag is needed in the URL.
function connectUrl(formId, feature, skeletonId) {
  var mode = feature === 'site' ? 'site' : 'embed';
  var url = APP_BASE + '/dashboard?form=' + encodeURIComponent(formId) + '&feature=' + mode;
  if (mode === 'site' && skeletonId) {
    url += '&skeleton=' + encodeURIComponent(skeletonId);
  }
  return url;
}

// Resolve-and-302 into the Site tab (/dashboard/forms/<localId>/site) for a
// connected site. Same URL as the site connect link; the web app tells the
// two cases apart by whether the form already has a row.
function siteSettingsUrl(formId) {
  return connectUrl(formId, 'site');
}

// Server endpoint for in-place syncing — the modal now triggers this
// from Apps Script via UrlFetchApp so there's no redirect into the web
// app. Kept as a helper for clarity even though it's a single URL.
function addonSyncUrl(formId) {
  return APP_BASE + '/api/forms/addon-sync';
}

// Where Code.js uploads the image bytes the sync response reported as
// missing. One multipart POST per image.
function addonImageUrl() {
  return APP_BASE + '/api/forms/addon-image';
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

// Same resolve-and-302 trick as customizeUrl, landing on the File upload
// tab (/dashboard/forms/<localId>/uploads).
function uploadsUrl(formId) {
  return APP_BASE + '/dashboard?form=' + encodeURIComponent(formId) + '&feature=file-upload';
}

function statusUrl(formId) {
  return APP_BASE + '/api/forms/status?formId=' + encodeURIComponent(formId);
}

// Form skeletons (the structure a site vertical starts from) are static
// JSON on the web app. The index lists { id, vertical, name }; each file
// carries the items Skeletons.js writes into the form.
function skeletonIndexUrl() {
  return APP_BASE + '/api/sites/skeletons.json';
}

function skeletonUrl(skeletonId) {
  return APP_BASE + '/api/sites/skeletons/' + encodeURIComponent(skeletonId) + '.json';
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
  var images = {};

  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var serialized = serializeItem(it, isQuiz);
    if (!serialized) continue;
    serializedItems.push(serialized.json);
    if (serialized.image) {
      images[serialized.image.sha256] = serialized.image.blob;
    }
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
    // Blobs keyed by sha256, outside `schema` so the JSON body never
    // carries image bytes. Code.js strips this before the sync POST and
    // uploads only the hashes the web app asks for.
    images: images,
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
    var image = serializeImage(item);
    return {
      json: Object.assign({}, base, { imageItem: image.json }),
      type: 'image',
      image: image.sha256 ? { sha256: image.sha256, blob: image.blob } : null,
    };
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

// Image items carry their bytes through FormApp (the REST contentUri is
// never available to us, and the web app holds no Forms scope). The JSON
// carries only a content hash; the blob rides alongside so Code.js can
// upload the ones the web app has never seen. Anything that fails to read,
// is empty, or is over 10 MB serializes as the bare imageItem it always
// did, and the renderer skips it as before.
var MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function serializeImage(item) {
  var empty = { json: {}, blob: null, sha256: null };
  var imageItem = safeGet(function () { return item.asImageItem(); });
  if (!imageItem) return empty;
  var blob = safeGet(function () { return imageItem.getImage(); });
  if (!blob) return empty;
  var bytes = safeGet(function () { return blob.getBytes(); });
  if (!bytes || bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return empty;
  var sha256 = safeGet(function () { return sha256Hex(bytes); });
  if (!sha256) return empty;

  var alignment = safeGet(function () { return imageItem.getAlignment(); });
  return {
    json: {
      image: {
        sha256: sha256,
        contentType: safeGet(function () { return blob.getContentType(); }) || '',
        altText: item.getTitle() || '',
      },
      width: safeGet(function () { return imageItem.getWidth(); }),
      alignment: alignment ? String(alignment) : '',
    },
    blob: blob,
    sha256: sha256,
  };
}

// Utilities.computeDigest returns signed bytes (-128..127); mask each one
// before printing so the hex matches what the web app computes.
function sha256Hex(bytes) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  var hex = '';
  for (var i = 0; i < digest.length; i++) {
    var byte = digest[i] & 0xff;
    hex += (byte < 16 ? '0' : '') + byte.toString(16);
  }
  return hex;
}

function choices(arr) {
  var out = [];
  for (var i = 0; i < arr.length; i++) out.push({ value: arr[i].getValue() });
  return out;
}

function safeGet(fn) { try { return fn(); } catch (_) { return null; } }
