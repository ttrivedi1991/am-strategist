// Runtime data store. Populated once by AMContext after Firestore load, then
// read synchronously by components and libs. Keeps confidential data out of
// the bundle — nothing here is a literal, only a holder filled at runtime.
import type { AppData, LiveMeta } from "./types";

let _data: AppData | null = null;

export function setAppData(d: AppData) {
  _data = d;
}

export function getAppData(): AppData {
  if (!_data) throw new Error("App data not loaded yet — AMContext must finish loading before this is read.");
  return _data;
}

export function getLiveMeta(): LiveMeta {
  return getAppData().liveMeta;
}
