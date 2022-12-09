import { Atom, useAtomValue } from 'jotai';
import { selectAtom } from 'jotai/utils';
import { useConstant } from '../react'

export function useSelectAtom<V, S>(atom: Atom<V>, selector: (v: Awaited<V>) => S) {
  return useAtomValue(
    selectAtom(
      atom,
      useConstant(() => selector)
    )
  );
}