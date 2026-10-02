/**
 * The bearer token lives in the iOS keychain (expo-secure-store), with an in-memory copy so
 * requests can read it synchronously. Listeners hear about sign-in, sign-out and dead tokens.
 */
import * as SecureStore from "expo-secure-store";

const KEY = "nostos.token";
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

type Listener = (token: string | null) => void;

let memory: string | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(memory);
}

export const tokenStore = {
  current: () => memory,

  async load(): Promise<string | null> {
    try {
      memory = await SecureStore.getItemAsync(KEY, OPTIONS);
    } catch {
      memory = null;
    }
    return memory;
  },

  /** Persist first, then switch: a keychain failure throws and the user stays signed out. */
  async set(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEY, token, OPTIONS);
    memory = token;
    emit();
  },

  /** Forget locally right away; the keychain delete follows. Returns the token that was cleared. */
  async clear(): Promise<string | null> {
    const previous = memory;
    memory = null;
    emit();
    await SecureStore.deleteItemAsync(KEY, OPTIONS).catch(() => undefined);
    return previous;
  },

  /** A 401 `invalid_token` for `sentToken`: sign out only if that's still the current token. */
  invalidate(sentToken: string): void {
    if (memory === null || memory !== sentToken) return;
    void tokenStore.clear();
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
