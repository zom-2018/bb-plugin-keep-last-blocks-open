// Keeps the newest work blocks of each thread expanded and folds older ones.
//
// A block is a top-level timeline row with its own expand toggle: a work group
// ("Ran 2 commands", "Explored 1 search"), a single command, a file edit, or a
// reasoning ("Thought") row when countThoughts is on. Only these rows count
// toward the quota. Rows nested in a block do not count and are left to bb.
//
// Messages, turn markers and notices are never blocks: assistant and user
// messages, "Worked for" turn rows, and error or warning rows.
//
// Per thread pane:
// - while the thread runs (its "Stop run" button is present), the newest
//   runningBlocks blocks stay open;
// - once the final answer appears (idle thread, assistant message after the
//   newest block), the newest answeredBlocks blocks stay open;
// - a count of 0 turns that mode off: bb's own state is left alone;
// - a block is changed only when its target changes. A block that keeps its
//   target keeps whatever state the user gave it.
//
// The rules rest on bb's timeline DOM: data-timeline-row-id, data-thread-window,
// aria-expanded toggles and the "Stop run" label. A bb update that renames them
// turns this into a no-op rather than an error.

export interface KeepConfig {
  /** Blocks left open while the thread runs. 0 turns this mode off. Max 10. */
  runningBlocks: number;
  /** Blocks left open after the final answer. 0 turns this mode off. Max 3. */
  answeredBlocks: number;
  /** Whether "Thought" (reasoning) rows count as blocks. */
  countThoughts: boolean;
}

export const DEFAULTS: KeepConfig = { runningBlocks: 5, answeredBlocks: 1, countThoughts: true };

const LIMITS = { runningBlocks: 10, answeredBlocks: 3 } as const;

const ROW = "data-timeline-row-id";
const PANE = "[data-thread-window]";
const STOP_RUN = 'button[aria-label="Stop run"]';
const TOGGLE = "button[aria-expanded], [role='button'][aria-expanded]";
// Kinds of timeline rows that are messages or notices, not work blocks.
const NOTICE_KINDS = new Set(["assistant", "user", "user-seed", "turn", "error"]);

let config: KeepConfig = { ...DEFAULTS };
// Running passes, so a settings change applies without waiting for a DOM mutation.
const configListeners = new Set<() => void>();

/**
 * Applies the plugin's settings. Missing or invalid values fall back to the
 * defaults; counts are clamped to their limits. Takes effect on the next pass.
 */
export function setKeepConfig(values: Record<string, unknown> | undefined): void {
  if (!values) return;
  config = {
    runningBlocks: clampInt(values.runningBlocks, DEFAULTS.runningBlocks, 0, LIMITS.runningBlocks),
    answeredBlocks: clampInt(values.answeredBlocks, DEFAULTS.answeredBlocks, 0, LIMITS.answeredBlocks),
    countThoughts: toBool(values.countThoughts, DEFAULTS.countThoughts),
  };
  for (const listener of configListeners) listener();
}

interface Block {
  row: HTMLElement;
  toggle: HTMLElement;
}

interface Applied {
  row: HTMLElement;
  open: boolean;
}

/** Starts the rules and returns the disposer the host calls on teardown. */
export function keepLastBlocksOpen(): () => void {
  const applied = new Map<string, Applied>();
  let frame = 0;
  let stopped = false;

  const schedule = () => {
    if (frame || stopped) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!stopped) sync();
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-expanded", "aria-label"],
  });
  configListeners.add(schedule);
  schedule();

  function sync() {
    const panes = new Map<Element, HTMLElement[]>();
    for (const row of document.querySelectorAll<HTMLElement>(`[${ROW}]`)) {
      const pane = row.closest(PANE) ?? document.body;
      const list = panes.get(pane);
      if (list) list.push(row);
      else panes.set(pane, [row]);
    }
    for (const [pane, rows] of panes) planPane(pane, rows);
    for (const [id, entry] of applied) {
      if (!entry.row.isConnected) applied.delete(id);
    }
  }

  function planPane(pane: Element, rows: HTMLElement[]) {
    const blocks = topLevelBlocks(rows, config.countThoughts);
    if (blocks.length === 0) return;

    const newest = blocks[blocks.length - 1];
    const running = pane.querySelector(STOP_RUN) !== null;
    const answered = !running && answerAfter(rows, newest.row);
    const keep = answered ? config.answeredBlocks : config.runningBlocks;
    if (keep === 0) return;

    const kept = new Set(blocks.slice(-keep).map((b) => b.row));
    for (const { row, toggle } of blocks) {
      const id = row.getAttribute(ROW) ?? "";
      const want = kept.has(row);
      const prev = applied.get(id);
      if (prev && prev.row === row && prev.open === want) continue;
      applied.set(id, { row, open: want });
      if ((toggle.getAttribute("aria-expanded") === "true") !== want) toggle.click();
    }
  }

  return () => {
    stopped = true;
    configListeners.delete(schedule);
    observer.disconnect();
    if (frame) cancelAnimationFrame(frame);
    applied.clear();
  };
}

/** Kind of a timeline row, read from its id: thread:kind:... or thread:turn:kind:... */
export function kindOf(id: string): string {
  const parts = id.split(":");
  const turnScoped = /-t\d+$/.test(parts[1] ?? "");
  const i = turnScoped ? 2 : 1;
  const kind = parts[i] ?? "";
  return kind === "op" ? `op:${parts[i + 1] ?? ""}` : kind;
}

/** A row is a block when it is not a message or notice. Thoughts count only when asked. */
export function isBlockKind(kind: string, countThoughts: boolean): boolean {
  if (kind === "op:reasoning") return countThoughts;
  return !NOTICE_KINDS.has(kind) && !kind.startsWith("op:");
}

/** Top-level block rows in timeline order. Rows nested in a block are skipped. */
function topLevelBlocks(rows: HTMLElement[], countThoughts: boolean): Block[] {
  const blocks: Block[] = [];
  let outer: HTMLElement | null = null;
  for (const row of rows) {
    if (outer?.contains(row)) continue;
    if (!isBlockKind(kindOf(row.getAttribute(ROW) ?? ""), countThoughts)) continue;
    const toggle = toggleOf(row);
    if (!toggle) continue;
    blocks.push({ row, toggle });
    outer = row;
  }
  return blocks;
}

/** The row's own toggle, skipping toggles of rows nested inside it. */
function toggleOf(row: HTMLElement): HTMLElement | null {
  for (const el of row.querySelectorAll<HTMLElement>(TOGGLE)) {
    if (el.closest(`[${ROW}]`) === row) return el;
  }
  return null;
}

/** True when an assistant message follows the row in timeline order. */
function answerAfter(rows: HTMLElement[], row: HTMLElement): boolean {
  const at = rows.indexOf(row);
  return rows.slice(at + 1).some((r) => kindOf(r.getAttribute(ROW) ?? "") === "assistant");
}

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  if (!Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function toBool(raw: unknown, fallback: boolean): boolean {
  if (typeof raw === "boolean") return raw;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return fallback;
}
