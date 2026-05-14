// Until prod cuts over, everything lives on dev.takumiform.com. When
// takumiform.com is live, swap both constants — embed.js is served from
// the same Astro app, no separate cdn. subdomain in the plan.
const APP_BASE = 'https://dev.takumiform.com';
const CDN_URL = 'https://dev.takumiform.com/embed.js';
const NPM_PKG = '@takumiform/react';

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

function getEmbedData() {
  const form = FormApp.getActiveForm();
  const formId = form.getId();
  return {
    formId: formId,
    title: form.getTitle() || 'Untitled form',
    script: scriptSnippet(formId),
    react: reactSnippet(formId),
    reactInstall: reactInstall(),
    iframe: iframeSnippet(formId),
    editorUrl: editorUrl(formId),
    previewUrl: APP_BASE + '/f/' + formId
  };
}
