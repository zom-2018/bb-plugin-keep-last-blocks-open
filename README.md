# bb-plugin-keep-last-blocks-open

A BB plugin that keeps the newest work blocks of a thread expanded and folds
the older ones.

While a thread runs, the newest **5** blocks stay open, counted across all
levels. When the final answer appears, only the **last block** stays open. Blocks
that fall out of the window fold again. Your manual toggles on a block that
keeps its place are left alone.

## Settings

Open the plugin's settings page (Settings → Installed plugins → Keep Last Blocks Open).

| Setting | Default | Range | Meaning |
| --- | --- | --- | --- |
| Open blocks while the thread runs | 5 | 0–10 | Newest blocks kept open while the thread runs. `0` turns this mode off. |
| Open blocks after the final answer | 1 | 0–3 | Newest blocks kept open after the final answer. `0` turns this mode off. |
| Count Thought as a block | on | on / off | Whether "Thought" (reasoning) rows count toward the quota. |

With a count of `0`, bb's own fold state is left as it is in that mode.
Changes apply at once; no reload is needed.

## What counts as a block

A block is any timeline row with its own expand toggle, at any depth:

- work groups such as "Ran 2 commands" or "Explored 1 search", and the rows
  nested inside them;
- single command, file-edit and provider rows;
- "Thought" rows, when *Count Thought as a block* is on.

Blocks are counted in timeline order across all levels. The newest N take the
slots. A group that holds a kept block opens to show it, but it takes no slot
of its own. For example, with the default 5, three groups of seven sub-blocks
open the last five sub-blocks of the newest group, and that group opens with
them.

Messages (yours and the agent's), "Worked for" turn markers, and error or
warning notices are never blocks.

## How it works

- `keep-open.ts` runs as a trusted content script in the bb app shell. It reads
  the timeline DOM (`data-timeline-row-id`, `data-thread-window`, the
  `aria-expanded` toggles, and the "Stop run" button) and clicks a block's
  toggle only when that block's target changes.
- `app.tsx` reads the settings with `useSettings`. A thread action with
  `item: () => null` carries the values to the content script, so no button
  appears.
- `server.ts` declares the three settings.

## Limits

- The plugin depends on bb's timeline markup. A bb update that renames the
  attributes or the "Stop run" label can make it stop acting, or act on the
  wrong rows. Unknown markup is skipped rather than thrown, but not every
  partial markup change has been tested.
- A run stopped before its answer is not treated as a final answer. The
  running count stays in place.
- Each thread pane is planned on its own. A split view has not been tested
  live.

## Development

```sh
npm install
npx tsc -p tsconfig.json   # typecheck
bb plugin build .          # build dist/
bb plugin install . --yes  # install from this checkout (path source)
bb plugin reload keep-last-blocks-open
```

## License

MIT. See [LICENSE](LICENSE).
