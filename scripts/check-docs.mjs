// ─────────────────────────────────────────────────────────────────────────────
// MARK: check-docs — docs-as-code gate for docs/architecture + docs/adr
// ─────────────────────────────────────────────────────────────────────────────
// ! Gate, not linter: fails when an agent session took a shortcut (missing doc for a
// !   registered feature, broken reference path, missing mandatory section, stale
// !   Verified footer on a doc whose component changed).
// * Scope: docs/architecture/*.md + docs/adr/*.md. Exit 0 = docs trustworthy.
// * Source of truth: skill "arch-docs" (check-docs.mjs reference) — project instances
//   at scripts/check-docs.mjs are generated from it. Adapt ONLY the PROJECT HOOKs
//   below, never fork whole sections.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ─── PROJECT HOOKS (the only project-specific lines) ──────────────────────────

// * Hook 1: registry file that registers the project's features/components.
//   The gate reads it to enforce doc coverage per registered entry.
//   No registry in this project? Set to null — section 1 is skipped.
const REGISTRY_FILE = "src/lib/core/features/index.ts";
// * Hook 2: registration call pattern with one capture group for the variable name.
const REGISTRY_CALL = /registerFeature\((\w+Feature)\)/g;
// * Hook 3: deliberately gitignored path patterns (captured YouTube fixtures under
//   __fixtures__ are real DOM data — they must never be published). Docs legitimately
//   reference them; on a fresh clone (or in CI) those files are absent, so the
//   reference-existence gate downgrades them to a warning instead of failing.
const GLOBALLY_IGNORED_PATH_RE = /(^|\/)__fixtures__\//;

// ─── End of hooks — everything below is generic ───────────────────────────────

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const archDir = join(root, "docs", "architecture");
const adrDir = join(root, "docs", "adr");

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const read = (p) => readFileSync(p, "utf8");

/** Resolves repo-relative path references used in docs. */
const refExists = (ref) => {
    const p = join(root, ref.replace(/`/g, "").trim());
    return existsSync(p);
};

// * Extracts repo-relative path literals (backtick-quoted, no wildcards/spaces).
// * Matches any top-level directory that exists in the repo — projects differ in
// * layout (src/, e2e/, scripts/, docs/); the existence check filters noise.
function extractPaths(markdown) {
    const out = [];
    const re = /`([A-Za-z0-9_.\-]+(?:\/[A-Za-z0-9_.\-]+)+)`/g;
    let m;
    while ((m = re.exec(markdown))) {
        const p = m[1];
        if (/\.(md|ts|tsx|js|mjs|svelte|json|jsonc|py|yaml|yml|html|css)$/.test(p)) out.push(p);
    }
    return out;
}

// ─── 1. Feature coverage: every registered feature has an INDEX row + doc link ─

const indexSrc = read(join(archDir, "INDEX.md"));
const hasRegistry = REGISTRY_FILE !== null && existsSync(join(root, REGISTRY_FILE));

if (hasRegistry) {
    const regSrc = read(join(root, REGISTRY_FILE));
    const registered = [...regSrc.matchAll(REGISTRY_CALL)].map((m) => m[1]);

    // * Maps registry variable (e.g. gridStylingFeature) → feature id (e.g.
    // * "grid-styling") by scanning the features directory for `id: "..."` + the
    // * export that matches the registration variable.
    const registryDir = join(root, dirname(REGISTRY_FILE));
    const featureIdMap = new Map();
    for (const file of readdirSync(registryDir)) {
        if (!file.endsWith(".ts") && !file.endsWith(".js")) continue;
        if (file === "index.ts" || file === "index.js") continue;
        const src = read(join(registryDir, file));
        const idMatch = src.match(/id:\s*"([^"]+)"/);
        for (const varMatch of src.matchAll(/export const (\w+)/g)) {
            if (idMatch) featureIdMap.set(varMatch[1], idMatch[1]);
        }
    }

    for (const regVar of registered) {
        const id = featureIdMap.get(regVar);
        if (!id) {
            fail(`could not resolve feature id for ${regVar} — check its "id" export`);
            continue;
        }
        if (!indexSrc.includes("`" + id + "`")) {
            fail(`registered feature "${id}" has no row in docs/architecture/INDEX.md (feature coverage gap)`);
        }
    }
}

// * INDEX rows with "documented" must link an existing doc.
for (const m of indexSrc.matchAll(/\|\s*`([\w-]+)`\s*\|\s*\[[^\]]+\]\(([^)]+)\)\s*\|\s*documented[^|]*\|/g)) {
    const doc = join(archDir, m[2].replace(/^\.?\//, ""));
    if (!existsSync(doc)) fail(`INDEX.md links missing doc: ${m[2]}`);
}

// ─── 2. Mandatory sections — feature docs vs cross-cutting docs ────────────────

// * Feature docs are the ones linked with "documented" status from the INDEX coverage
// * table. Cross-cutting docs (system-overview, testing, ...) only need References +
// * Verified. INDEX.md is the classification source of truth.
const featureDocs = new Set(
    [...indexSrc.matchAll(/\|\s*`([\w-]+)`\s*\|\s*\[[^\]]+\]\(([^)]+)\)\s*\|\s*documented[^|]*\|/g)].map((m) =>
        m[2].replace(/^\.?\//, ""),
    ),
);

const REQUIRED_ALL = [/## References/];
const REQUIRED_FEATURE = [/## Component Structure/, /## Scope Boundaries/];

for (const file of readdirSync(archDir)) {
    if (!file.endsWith(".md") || file === "INDEX.md" || file === "_template.md") continue;
    const src = read(join(archDir, file));
    const isFeatureDoc = featureDocs.has(file);

    for (const section of [...REQUIRED_ALL, ...(isFeatureDoc ? REQUIRED_FEATURE : [])]) {
        if (!section.test(src)) {
            const kind = isFeatureDoc ? "feature doc" : "doc";
            fail(`${file}: missing mandatory section for ${kind}: "${section.source.replace(/\\/g, "")}"`);
        }
    }

    // * Verified footer — mandatory on all component docs; stale date = warning only.
    if (!/^Verified:\s*(\d{4}-\d{2}-\d{2})/m.test(src)) {
        fail(`${file}: missing "Verified: YYYY-MM-DD — against ..." footer`);
    }

    // ─── 3. Reference paths must exist ────────────────────────────────────────

    for (const ref of extractPaths(src)) {
        if (!refExists(ref)) {
            // * Hook 3: gitignored-by-design references (fixtures) — warn, don't fail.
            if (GLOBALLY_IGNORED_PATH_RE.test(ref)) {
                warn(`${file}: referenced path is gitignored by design (fixtures absent on fresh clones): ${ref}`);
                continue;
            }
            fail(`${file}: referenced path does not exist: ${ref}`);
        }
    }

    // ─── 4. Mermaid sanity ─────────────────────────────────────────────────────

    const mermaidBlocks = [...src.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) => m[1]);
    if (mermaidBlocks.length === 0) {
        warn(`${file}: no mermaid diagram found (component docs should have at least one)`);
    }
    for (const block of mermaidBlocks) {
        const firstLine = block.trim().split("\n")[0].trim();
        const known =
            /^(flowchart|sequenceDiagram|classDiagram|stateDiagram-v2|erDiagram|journey|gantt|pie|mindmap|gitGraph)\b/;
        if (!known.test(firstLine)) {
            fail(`${file}: mermaid block starts with unknown diagram type: "${firstLine}"`);
        }
        if (block.includes("\\n")) {
            fail(`${file}: mermaid label contains literal \\n — use <br/> for portability`);
        }
        // * subgraph/end balancing applies to flowcharts only — sequenceDiagram uses "end"
        // * for alt/opt/loop blocks, which would false-positive.
        if (/^flowchart\b/.test(firstLine)) {
            const openSubs = (block.match(/subgraph /g) || []).length;
            const closeSubs = (block.match(/^\s*end\b/gm) || []).length;
            if (openSubs !== closeSubs) {
                fail(`${file}: mermaid subgraph/end mismatch (${openSubs} subgraph vs ${closeSubs} end)`);
            }
        }
    }
}

// ─── 5. ADR sanity ─────────────────────────────────────────────────────────────

for (const file of readdirSync(adrDir)) {
    if (!file.endsWith(".md")) continue;
    const src = read(join(adrDir, file));
    if (!/^#\s*ADR \d+:/m.test(src)) fail(`${file}: missing "ADR NNNN:" title`);
    for (const section of [/## Context/, /## Decision/, /## Consequences/]) {
        if (!section.test(src)) fail(`${file}: missing mandatory ADR section "${section.source.replace(/\\/g, "")}"`);
    }
}

// * Every INDEX "ADR" table row must link an existing adr doc.
for (const m of indexSrc.matchAll(/\[(\d+)\]\((\.\.\/adr\/[^)]+)\)/g)) {
    const p = join(archDir, m[2]);
    if (!existsSync(p)) fail(`INDEX.md links missing ADR: ${m[2]}`);
}

// ─── 6. Staleness: doc mtime vs newest referenced source mtime (warning) ───────

// * A component doc older than the newest source file it references may be stale —
// * surface it as a warning (re-verify, update the Verified footer).
for (const file of readdirSync(archDir)) {
    if (!file.endsWith(".md") || file === "INDEX.md" || file === "_template.md") continue;
    const p = join(archDir, file);
    const src = read(p);
    let newest = 0;
    for (const ref of extractPaths(src)) {
        const rp = join(root, ref);
        if (existsSync(rp) && statSync(rp).isFile()) newest = Math.max(newest, statSync(rp).mtimeMs);
    }
    const docTime = statSync(p).mtimeMs;
    if (docTime < newest) {
        warn(`${file}: older than a referenced source file — re-verify and update the Verified footer`);
    }
}

// ─── Report ───────────────────────────────────────────────────────────────────

for (const w of warnings) console.warn(`docs:check WARN  ${w}`);
for (const e of errors) console.error(`docs:check FAIL  ${e}`);
console.log(
    `docs:check — ${readdirSync(archDir).length + readdirSync(adrDir).length} files, ` +
        `${errors.length} error(s), ${warnings.length} warning(s)`,
);
if (errors.length > 0) {
    process.exitCode = 1;
}
