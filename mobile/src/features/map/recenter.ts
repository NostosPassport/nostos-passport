type Listener = () => void;

const listeners = new Set<Listener>();

export const mapRecenter = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  request() {
    for (const listener of listeners) listener();
  },
};
