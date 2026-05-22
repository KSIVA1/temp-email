// Install-prompt orchestration.
// Browsers fire `beforeinstallprompt` only when the install criteria are met.
// We catch it, hold the event, reveal our button, then call .prompt() on click.

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
    appinstalled: Event;
  }
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: ReadonlyArray<string>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

let deferred: BeforeInstallPromptEvent | null = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  const btn = document.getElementById('install-btn');
  if (btn) btn.hidden = false;
});

window.addEventListener('appinstalled', () => {
  deferred = null;
  const btn = document.getElementById('install-btn');
  if (btn) btn.hidden = true;
});

document.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement;
  if (!target.closest('#install-btn')) return;
  if (!deferred) return;
  deferred.prompt();
  await deferred.userChoice;
  deferred = null;
  const btn = document.getElementById('install-btn');
  if (btn) btn.hidden = true;
});
