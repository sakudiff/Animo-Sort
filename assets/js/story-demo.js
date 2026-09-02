const STORY_DEMO_IMAGE = 'assets/images/animosort-schedule-export.png';

const storyOutput = document.querySelector('#story-demo-output');
const storyOutputDialogImage = document.querySelector('#story-output-dialog-image');
const outputTrigger = document.querySelector('#story-output-trigger');
const outputDialog = document.querySelector('#story-output-dialog');
const outputClose = document.querySelector('#story-output-close');
const sourceReceipt = document.querySelector('#story-source-receipt');
const sourceDialog = document.querySelector('#story-source-dialog');
const sourceClose = document.querySelector('#story-source-close');

if (storyOutput) {
  storyOutput.src = STORY_DEMO_IMAGE;
  if (storyOutputDialogImage) storyOutputDialogImage.src = STORY_DEMO_IMAGE;
  storyOutput.dataset.ready = 'true';
}

function bindStoryDialog(trigger, dialog, closeButton) {
  if (!trigger || !dialog || !closeButton) return;

  let lastTrigger = null;

  trigger.addEventListener('click', () => {
    lastTrigger = trigger;
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    trigger.setAttribute('aria-expanded', 'true');
  });

  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    trigger.setAttribute('aria-expanded', 'false');
    if (lastTrigger) lastTrigger.focus();
  });
}

bindStoryDialog(sourceReceipt, sourceDialog, sourceClose);
bindStoryDialog(outputTrigger, outputDialog, outputClose);
