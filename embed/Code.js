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
  const ui = HtmlService.createTemplateFromFile('Sidebar')
    .evaluate()
    .setTitle('TakumiForm — Embed');
  FormApp.getUi().showSidebar(ui);
}

// Used by Sidebar.html via `<?!= include('Stylesheet') ?>` to inline the
// shared sidebar CSS at render time. Keeps Stylesheet.html as a single
// source of truth for the add-on's design tokens and component styles.
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Single data fetch for the sidebar UI. Also checks whether the form is
// already connected to TakumiForm so the sidebar can render the right
// state — disconnected (one big "Connect" CTA) or connected (the snippet
// and supporting actions).
function getEmbedData() {
  const form = FormApp.getActiveForm();
  const formId = form.getId();
  const status = fetchStatus(formId);
  return {
    formId: formId,
    title: form.getTitle() || 'Untitled form',
    connected: status.connected,
    updatedAt: status.updatedAt || null,
    script: scriptSnippet(formId),
    iframe: iframeSnippet(formId),
    // Both URL variants — sidebar JS picks one based on the auto-publish
    // checkbox on the welcome screen, no extra server round-trip needed.
    connectUrl: connectUrl(formId, false),
    connectAndPublishUrl: connectUrl(formId, true),
    syncUrl: syncUrl(formId),
    previewUrl: previewUrl(formId)
  };
}

// Returns { connected: bool, updatedAt?: number } from our server. Used
// by the sidebar on load and by the "Refresh" link after the user has
// connected or synced in a separate tab.
function fetchStatus(formId) {
  try {
    const res = UrlFetchApp.fetch(statusUrl(formId), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return { connected: false };
    return JSON.parse(res.getContentText());
  } catch (e) {
    return { connected: false };
  }
}
