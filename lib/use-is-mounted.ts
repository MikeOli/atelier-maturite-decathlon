"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * False during SSR and the first client render, true once hydrated.
 *
 * Replaces the `useState(false)` + `setState(true)` in an effect pattern:
 * both gate client-only rendering the same way, but this one reports the
 * change through the store React already consults during render, instead
 * of scheduling a second render pass from inside an effect
 * (react-hooks/set-state-in-effect).
 */
export function useIsMounted() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
