import {
  useCallback,
  useLayoutEffect,
  useEffect,
  useRef,
  useState,
} from "react";

import { dequal as equals } from "dequal/lite";

type Fn<A extends any[], R> = (...args: A) => R;
type EventRef<T> = { callback: T; stable: T };

/**
 * React hook for creating a value exactly once. useMemo doesn't give this guarantee unfortunately
 * see https://github.com/Andarist/use-constant
 */
export function useConstant<T>(fn: () => T): T {
  const ref = useRef<{ v: T }>();

  if (!ref.current) {
    ref.current = { v: fn() };
  }

  return ref.current.v;
}

/**
 * see https://github.com/Andarist/use-isomorphic-layout-effect
 */
export const useIsomorphicLayoutEffect =
  typeof document !== "undefined" ? useLayoutEffect : useEffect;

/**
 * A Hook to define an event handler with an always-stable function identity. Aimed to be easier to use than useCallback.
 * see proposal https://github.com/reactjs/rfcs/blob/useevent/text/0000-useevent.md
 */
export const useEvent = <A extends any[], R>(callback: Fn<A, R>): Fn<A, R> => {
  let ref = useRef<EventRef<Fn<A, R>>>({
    stable: (...args) => ref.current.callback(...args),
    callback,
  });

  useIsomorphicLayoutEffect(() => {
    ref.current.callback = callback;
  });

  return ref.current.stable;
};

/**
 * Returns a handler with pending states, useful for async events
 *
 * The hook returns an array with two elements.
 *
 * The first element is an object containing the pending and error state.
 * The pending state is a boolean that indicates whether
 * the asynchronous function is currently executing.
 * The error state is an Error object if an error occurred during execution, or null otherwise.
 *
 * The second element in the array is a function that takes
 * a callback function as an argument and returns a memoized version of the callback.
 * The memoized version of the callback will be used to track the pending and error state.
 */
export const usePendingEvent = () => {
  let [pending, setPending] = useState(false);
  let [error, setError] = useState<Error | null>(null);

  let ref = useRef<Fn<any, unknown>>(() => null);

  let memoized = useCallback(async (...args) => {
    let result: unknown;

    setError(null);
    setPending(true);
    try {
      result = await ref.current(...args);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e);
      }
    } finally {
      setPending(false);
      return result;
    }
  }, []);

  return [
    { pending, error },
    <A extends any[], R>(callback: Fn<A, R>): Fn<A, R> => {
      ref.current = callback;
      return memoized as unknown as Fn<A, R>;
    },
  ] as const;
};

/**
 * Effects that should run only once
 * https://github.com/reactwg/react-18/discussions/18#discussion-3385714
 */
export function useEffectOnce(effectCb: React.EffectCallback) {
  const calledOnce = useRef(false);

  useEffect(() => {
    if (calledOnce.current === false) {
      calledOnce.current = true;

      return effectCb();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Simple React hook that return a boolean;
 * @returns True at the mount time, Then always false
 */
export function useIsFirstRender(): boolean {
  const isFirst = useRef(true);

  if (isFirst.current) {
    isFirst.current = false;

    return true;
  }

  return isFirst.current;
}

/**
 * A modified version of useEffect that is skipping the first render.
 */
export function useUpdateEffect(
  effect: React.EffectCallback,
  deps?: React.DependencyList
) {
  const isFirst = useIsFirstRender();

  useEffect(() => {
    if (!isFirst) {
      return effect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Converts a react hook function into a render prop component
 */
 export function withHook<A extends any[], R>(useHook: Fn<A, R>) {
  return function HookComponent({
    children,
    args,
  }: {
    children: (props: ReturnType<typeof useHook>) => React.ReactElement;
    args?: A;
  }) {
    const res = useHook(...((args ?? []) as A));
    return children(res);
  };
}

/**
 * Memoize a result using deep equality. This hook has two advantages over
 * React.useMemo: it uses deep equality to compare memo keys, and it guarantees
 * that the memo function will only be called if the keys are unequal.
 * React.useMemo cannot be relied on to do this, since it is only a performance
 * optimization (see https://reactjs.org/docs/hooks-reference.html#usememo).
 */
export function useDeepMemo<TKey, TValue>(
  memoFn: () => TValue,
  key: TKey
): TValue {
  const ref = useRef<{ key: TKey; value: TValue }>();

  if (!ref.current || !equals(key, ref.current.key)) {
    ref.current = { key, value: memoFn() };
  }

  return ref.current.value;
}

/**
 * see https://github.com/kentcdodds/use-deep-compare-effect#usage
 */
export function useDeepMemoEffect(
  callback: React.EffectCallback,
  deps: React.DependencyList | undefined
) {
  useEffect(
    callback,
    useDeepMemo(() => deps, equals)
  );
}

/**
 * Detects visibility of a component on the viewport using the IntersectionObserver API natively present in the browser.
 * @returns element Ref callback
 */
export function useIntersectionCallback<E extends Element>(
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit
) {
  let [element, setElement] = useState<E | null>(null);
  let { root, rootMargin, threshold } = options ?? {};

  let stableCallback = useEvent(callback);

  useEffect(() => {
    if (!element) return;

    let observer = new IntersectionObserver(stableCallback, {
      root,
      rootMargin,
      threshold,
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [element, stableCallback, root, rootMargin, threshold]);

  return (el: E) => setElement(el);
}

/**
 * Using the Intersection Observer API, this returns a tuple with two elements:
 * A boolean value indicating whether the element is intersecting with its parent or ancestor element.
 * An element Ref callback that can be attached to the element to be observed.
 */
export function useIsIntersecting(options?: IntersectionObserverInit) {
  let [isIntersecting, setIsIntersecting] = useState<boolean>(false);
  let elementRef = useIntersectionCallback(
    ([entry]) => setIsIntersecting(entry.isIntersecting),
    options
  );

  return [isIntersecting, elementRef];
}

/**
 * Automatically focus an element when it becomes visible in the viewport.
 * @returns A callback that can be attached to the element to be observed.
 */
export function useFocusElementOnVisible<T extends HTMLElement>() {
  return useIntersectionCallback<T>(
    ([entry], observer) => {
      if (entry.isIntersecting) {
        (entry.target as T).focus({ preventScroll: true });
        observer.disconnect();
      }
    },
    { threshold: 1 }
  );
}

/**
 * A simple abstraction to play with a counter
 */
export function useCounter(initialValue?: number) {
  const [count, setCount] = useState(initialValue || 0)

  const increment = () => setCount(x => x + 1)
  const decrement = () => setCount(x => x - 1)
  const reset = () => setCount(initialValue || 0)

  return {
    count,
    increment,
    decrement,
    reset,
    setCount,
  }
}

