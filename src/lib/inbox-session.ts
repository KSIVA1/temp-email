export type InboxSession = { id: string; address: string; expiresAt: number };

type SessionStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Options = {
  storage?: SessionStore;
  readInbox: (id: string) => Promise<unknown>;
  createInbox: () => Promise<unknown>;
  now?: () => number;
};
const KEY = 'ifn-active-inbox';
const ID = /^inb_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Store only this tab's opaque inbox identifier. Every reload revalidates it
// with the server; browser storage never extends the mailbox's lifetime.
export function createInboxSession(options: Options) {
  const now = options.now ?? Date.now;
  let currentId: string | undefined;
  let retainedInTab = false;
  let pending: Promise<InboxSession> | undefined;
  try {
    const saved = options.storage?.getItem(KEY);
    if (saved && ID.test(saved)) { currentId = saved; retainedInTab = true; }
    else if (saved) options.storage?.removeItem(KEY);
  } catch { /* A blocked session store must not prevent in-memory use. */ }

  function forget(expectedId?: string) {
    if (expectedId && currentId !== expectedId) return;
    currentId = undefined;
    retainedInTab = false;
    try { options.storage?.removeItem(KEY); } catch {}
  }

  function accept(value: unknown, expectedId?: string): InboxSession {
    const inbox = value as Partial<InboxSession> | null;
    if (!inbox || typeof inbox.id !== 'string' || !ID.test(inbox.id)
      || (expectedId && inbox.id !== expectedId)
      || typeof inbox.address !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inbox.address)
      || typeof inbox.expiresAt !== 'number' || !Number.isFinite(inbox.expiresAt) || inbox.expiresAt <= now()) {
      throw new Error('Invalid or expired inbox response');
    }
    currentId = inbox.id;
    retainedInTab = false;
    try {
      options.storage?.setItem(KEY, inbox.id);
      retainedInTab = options.storage?.getItem(KEY) === inbox.id;
    } catch {}
    return inbox as InboxSession;
  }

  function connect(replace = false): Promise<InboxSession> {
    if (pending) return pending;
    pending = (async () => {
      if (currentId && !replace) {
        const id = currentId;
        try { return accept(await options.readInbox(id), id); }
        catch (error) {
          // Only a definite missing/expired response permits replacement.
          // Offline, rate-limit and server errors preserve the original inbox.
          if (!(error && typeof error === 'object' && 'status' in error && error.status === 404)) throw error;
          forget(id);
        }
      }
      return accept(await options.createInbox());
    })().finally(() => { pending = undefined; });
    return pending;
  }

  return { connect, forget, get retainedInTab() { return retainedInTab; } };
}
