import '@testing-library/jest-dom';

// jsdom provides localStorage but it can be unreliable in test environments.
// Replace it with a simple in-memory mock so CartProvider's useEffect doesn't throw.
const storage: Record<string, string> = {};
const localStorageMock: Storage = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => { storage[key] = value; },
  removeItem: (key: string) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
  key: (index: number) => Object.keys(storage)[index] ?? null,
  get length() { return Object.keys(storage).length; },
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });
