// Until prod cuts over, everything lives on dev.takumiform.com. When
// takumiform.com is live, swap both constants — embed.js is served from
// the same Astro app, no separate cdn. subdomain in the plan.
const APP_BASE = 'https://dev.takumiform.com';
const CDN_URL = 'https://dev.takumiform.com/embed.js';

function onOpen(e) {
  FormApp.getUi()
    .createAddonMenu()
    .addItem('Get embed code', 'showSidebar')
    .addToUi();
}

function onInstall(e) {
  onOpen(e);
}

function showSidebar() {
  const ui = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('TakumiForm — Embed');
  FormApp.getUi().showSidebar(ui);
}

// Single data fetch for the sidebar UI. Also checks whether the form is
// already connected to TakumiForm so the sidebar can render the right
// state — disconnected (one big "Connect" CTA) or connected (the snippet
// and supporting actions).
function getEmbedData() {
  const form = FormApp.getActiveForm();
  const formId = form.getId();
  return {
    formId: formId,
    title: form.getTitle() || 'Untitled form',
    connected: isConnected(formId),
    script: scriptSnippet(formId),
    iframe: iframeSnippet(formId),
    connectUrl: connectUrl(formId),
    previewUrl: previewUrl(formId)
  };
}

// Called by the sidebar's "Refresh" link after the user has gone through
// the Connect flow in a new tab. Returns just the connection status so
// the UI can flip without a full reload.
function checkConnection() {
  return { connected: isConnected(FormApp.getActiveForm().getId()) };
}

function isConnected(formId) {
  try {
    const res = UrlFetchApp.fetch(statusUrl(formId), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return false;
    const body = JSON.parse(res.getContentText());
    return body.connected === true;
  } catch (e) {
    return false;
  }
}
