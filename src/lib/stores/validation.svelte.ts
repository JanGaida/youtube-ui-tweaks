import { validateSettings } from "../core/registry";
import type { ValidationError } from "../core/feature.types";
import type { Settings } from "../core/settings";

// ─────────────────────────────────────────────────────────────────────────────
// MARK: ValidationStore (Svelte 5 Runes) — reactive settings validation
// ─────────────────────────────────────────────────────────────────────────────
// * Aggregates feature.validate results into a reactive errors-by-path map. GUI components bind
//   to getErrors(path)/isValid(path) instead of inline validation rules. Revalidation is
//   triggered by store.setByPath after every settings mutation.

/** Reactive validation store. Errors keyed by settings dot-path. */
class ValidationStore {
    /** Map of settings dot-path → last validation error (empty when valid). */
    errors = $state<Record<string, ValidationError>>({});

    /**
     * Re-runs all feature validators against the given settings and updates the reactive errors
     * map. Call after every settings mutation (store.setByPath).
     *
     * @param settings - The current settings to validate.
     */
    revalidate(settings: Settings): void {
        const result = validateSettings(settings);
        const next: Record<string, ValidationError> = {};
        for (const err of result) {
            next[err.path] = err;
        }
        this.errors = next;
    }

    /**
     * Returns whether the value at a path is valid (no error recorded for it).
     *
     * @param path - The settings dot-path.
     * @returns True if no validation error is recorded for the path.
     */
    isValid(path: string): boolean {
        return !this.errors[path];
    }

    /**
     * Returns the validation error for a path, if any.
     *
     * @param path - The settings dot-path.
     * @returns The error, or undefined when valid.
     */
    getError(path: string): ValidationError | undefined {
        return this.errors[path];
    }
}

/** Singleton validation store instance. */
export const validation = new ValidationStore();
