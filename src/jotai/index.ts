import { Atom, useAtomValue } from 'jotai';
import { atomWithStorage, createJSONStorage, selectAtom } from 'jotai/utils';
import { useConstant } from '../react'

export function useSelectAtom<V, S>(atom: Atom<V>, selector: (v: Awaited<V>) => S) {
  return useAtomValue(
    selectAtom(
      atom,
      useConstant(() => selector)
    )
  );
}

export function atomWithSessionStorage<T>(key: string, initialValue: T) {
  return atomWithStorage<T>(
    key,
    initialValue,
    createJSONStorage(() =>
      typeof window !== 'undefined'
        ? window.sessionStorage
        : (undefined as unknown as Storage)
    )
  );
}
