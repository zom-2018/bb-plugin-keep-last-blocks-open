// bb-plugin-keep-last-blocks-open: frontend entry.
//
// keep-open.ts folds timeline blocks from a content script, which has no React
// context. Its settings come from the plugin's settings through useSettings.
// The thread action below hands them over: bb calls its useData once for the
// whole app, and item returns null, so no button ever shows.
import { useEffect } from "react";
import { definePluginApp, useSettings } from "@get-bb/plugin-sdk/app";
import { keepLastBlocksOpen, setKeepConfig } from "./keep-open";

export default definePluginApp((app) => {
  app.contentScripts.register({
    id: "keep-last-blocks-open",
    mount() {
      return keepLastBlocksOpen();
    },
  });

  app.slots.experimental_threadAction({
    id: "settings-bridge",
    title: "Keep Last Blocks Open settings",
    icon: "ChevronsDownUp",
    group: "keep-last-blocks-open",
    useData() {
      const { values } = useSettings();
      useEffect(() => setKeepConfig(values), [values]);
      return null;
    },
    item: () => null,
  });
});
