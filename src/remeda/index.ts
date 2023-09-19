import { omit, purry } from "remeda";
import { Narrow } from "remeda/dist/es/_narrow";
import { Path } from "remeda/dist/es/_paths";

export function deepOmit<T, TPath extends Array<PropertyKey> & Path<T>>(
  object: T,
  path: Narrow<TPath>
): unknown;

export function deepOmit<TPath extends Array<PropertyKey>, Value>(
  path: Narrow<TPath>
): <Obj>(object: Obj) => unknown;

export function deepOmit() {
  return purry(_deepOmit, arguments);
}

function _deepOmit<T>(value: T, target: readonly (keyof T)[]): unknown {
  if (Array.isArray(value)) {
    return value.map((elem) => _deepOmit(target, elem));
  } else if (typeof value === "object" && value !== null) {
    return Object.entries(omit(value, target)).reduce(
      (acc, [key, value]) => ({ ...acc, [key]: _deepOmit(value as T, target) }),
      {}
    );
  } else {
    return value;
  }
}