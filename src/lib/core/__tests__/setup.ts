/**
 * Vitest global setup — registers jest-dom matchers for DOM/fixture tests (jsdom environment).
 *
 * Pure-logic tests (node environment) are unaffected; the matchers are no-ops there.
 */
import "@testing-library/jest-dom/vitest";
