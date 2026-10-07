/* global jest */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const resolved = (v) => () => Promise.resolve(v);

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: resolved(true), isEnrolledAsync: resolved(true),
  authenticateAsync: resolved({ success: true }),
}));
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItemAsync: (k) => Promise.resolve(store.get(k) ?? null),
    setItemAsync: (k, v) => { store.set(k, v); return Promise.resolve(); },
    deleteItemAsync: (k) => { store.delete(k); return Promise.resolve(); },
  };
});
jest.mock('expo-haptics', () => ({ notificationAsync: resolved(), NotificationFeedbackType: { Error: 'error' } }));
jest.mock('@expo/vector-icons', () => {
  const Icon = () => null;
  return { Ionicons: Icon, __esModule: true };
});
jest.mock('expo-font', () => ({ loadAsync: () => Promise.resolve(), isLoaded: () => true, useFonts: () => [true, null] }), { virtual: true });

// Real English copy under Jest: t() resolves lib/i18n/en.json with {{interpolation}}.
jest.mock('react-i18next', () => {
  const en = require('./lib/i18n/en.json');
  const get = (k) => k.split('.').reduce((o, p) => (o == null ? o : o[p]), en);
  const t = (key, opts = {}) => {
    const v = get(key);
    if (v === undefined) return key;
    return String(v).replace(/\{\{(\w+)\}\}/g, (_, n) => (opts[n] !== undefined ? String(opts[n]) : `{{${n}}}`));
  };
  return { useTranslation: () => ({ t, i18n: { language: 'en', changeLanguage: () => Promise.resolve() } }), initReactI18next: { type: '3rdParty', init: () => {} } };
});
