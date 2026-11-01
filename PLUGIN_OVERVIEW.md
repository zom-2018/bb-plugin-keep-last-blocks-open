Keeps the newest work blocks of a thread open while the agent works, and folds
the older ones.

- While a thread runs, the newest 5 blocks stay open. Blocks are counted at
  every depth: a group like "Ran 2 commands" and the commands inside it both
  count.
- When the final answer appears, only the last block stays open.
- Blocks that fall out of the window fold again. Your own toggles on a block
  that keeps its place are left alone.

Settings, under the plugin's settings page:
- Open blocks while the thread runs: 0 to 10 (default 5, 0 turns this off).
- Open blocks after the final answer: 0 to 3 (default 1, 0 turns this off).
- Count Thought as a block (default on).

Changes apply at once. Nothing leaves the machine. The plugin reads the
timeline in the open app and needs no account, key, or service.
