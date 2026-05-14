function buildIntroCard() {
  const section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText(TAGLINE))
    .addWidget(
      CardService.newDecoratedText()
        .setText('Open a Google Form to set up scoring.')
        .setWrapText(true)
    );
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(TITLE))
    .addSection(section)
    .build();
}

function buildEditorCard(formId) {
  const url = `https://takumiform.com/app?form=${encodeURIComponent(formId)}&feature=${FEATURE}`;
  const button = CardService.newTextButton()
    .setText('Configure scoring')
    .setOpenLink(CardService.newOpenLink().setUrl(url).setOpenAs(CardService.OpenAs.FULL_SIZE))
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED);

  const section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText(TAGLINE))
    .addWidget(CardService.newButtonSet().addButton(button));

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(TITLE))
    .addSection(section)
    .build();
}
