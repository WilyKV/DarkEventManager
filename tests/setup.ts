import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Nettoyage automatique du DOM après chaque test
afterEach(() => {
  cleanup();
});

// Mock de matchMedia — requis par shadcn/Radix UI en environnement jsdom
// jsdom ne fournit pas window.matchMedia nativement
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock de ResizeObserver — utilisé par certains composants Radix
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
