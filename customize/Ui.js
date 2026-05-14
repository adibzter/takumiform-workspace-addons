function buildIntroCard() {
  const section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText(TAGLINE))
    .addWidget(
      CardService.newDecoratedText()
        .setText('Open a Google Form to start customizing.')
        .setWrapText(true)
    );
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(TITLE))
    .addSection(section)
    .build();
}

function buildEditorCard(formId) {
  const url = `https://takumiform.com/app?form=${encodeURIComponent(formId)}&feature=${FEATURE}`;
  const openAction = CardService.newOpenLink().setUrl(url).setOpenAs(CardService.OpenAs.FULL_SIZE);
  const button = CardService.newTextButton()
    .setText('Open editor')
    .setOpenLink(openAction)
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED);

  const section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText(TAGLINE))
    .addWidget(CardService.newButtonSet().addButton(button));

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(TITLE))
    .addSection(section)
    .build();
}
