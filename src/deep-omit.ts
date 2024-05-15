import { purry } from "remeda";
import { type Narrow } from "remeda/dist/types/_narrow.js";
import { type Path } from "remeda/dist/types/_paths.js";

type Tail<T extends any[]> = ((...t: T) => void) extends (
  h: any,
  ...r: infer R
) => void
  ? R
  : never;

type DeepOmit<T, Path extends Narrow<PropertyKey[]>> = T extends object
  ? Path["length"] extends 1
    ? Omit<T, Path[0]>
    : {
        [K in keyof T]: K extends Path[0] ? DeepOmit<T[K], Tail<Path>> : T[K];
      }
  : T;

export function deepOmit<T, TPath extends PropertyKey[] & Path<T>>(
  object: T,
  path: Narrow<TPath>
): DeepOmit<T, TPath>;

export function deepOmit<TPath extends PropertyKey[]>(
  path: Narrow<TPath>
): <T>(object: T) => DeepOmit<T, TPath>;

export function deepOmit() {
  return purry(_deepOmit, arguments);
}

function _deepOmit<T>(value: T, target: PropertyKey[]) {
  if (Array.isArray(value)) {
    let collect: unknown[] = [];
    for (let index = 0; index < value.length; index++) {
      collect.push(_deepOmit(target, value[index]));
    }
    return collect;
  } else if (typeof value === "object" && value !== null) {
    let collect: { [key: string]: unknown } = {};
    for (let [key, entryValue] of Object.entries(value)) {
      collect[key] = _deepOmit(entryValue as T, target);
    }

    return collect;
  } else {
    return value;
  }
}
