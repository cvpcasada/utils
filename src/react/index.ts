import {
  useCallback,
  useLayoutEffect,
  useEffect,
  useRef,
  useState,
  startTransition,
  useSyncExternalStore,
  createElement,
  Suspense,
  createContext,
} from "react";

import { dequal as equals } from "dequal/lite";
import { createNanoEvents } from "nanoevents";

export { default as useMediaQuery } from "./useMediaQuery";

type Fn<A extends any[], R> = (...args: A) => R;
type AnyFn<R> = Fn<any[], R>;
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
 * useEffectEvent (experimental) instead if event is only used as part of useEffect logic.
 * See https://react.dev/learn/separating-events-from-effects#declaring-an-effect-event
 */
export function useEvent<A extends any[], R>(callback: Fn<A, R>): Fn<A, R> {
  let ref = useRef<EventRef<Fn<A, R>>>({
    stable: (...args) => ref.current.callback(...args),
    callback,
  });

  useIsomorphicLayoutEffect(() => {
    ref.current.callback = callback;
  });

  return ref.current.stable;
}

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
export function usePendingEvent() {
  let [success, setSuccess] = useState(false);
  let [pending, setPending] = useState(false);
  let [error, setError] = useState<Error | null>(null);

  let ref = useRef<Fn<any, unknown>>(() => null);

  let memoized = useCallback(async (...args: unknown[]) => {
    let result: unknown;

    setError(null);
    setSuccess(false);
    setPending(true);
    try {
      result = await ref.current(...args);
      setSuccess(true);
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
    { pending, success, error },
    <A extends any[], R>(callback: Fn<A, R>): Fn<A, R> => {
      ref.current = callback;
      return memoized as unknown as Fn<A, R>;
    },
  ] as const;
}

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
  return isFirst.current ? !(isFirst.current = false) : false;
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
    useDeepMemo(() => deps, deps)
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
  const [count, setCount] = useState(initialValue || 0);

  const increment = () => setCount((x) => x + 1);
  const decrement = () => setCount((x) => x - 1);
  const reset = () => setCount(initialValue || 0);

  return {
    count,
    increment,
    decrement,
    reset,
    setCount,
  };
}

/**
 * Defer a suspense triggering function after a mount
 */
export function useSuspendAfterMount<ReturnType>(callback: AnyFn<ReturnType>) {
  const [didMount, setDidMount] = useState(false);

  useEffect(() => {
    startTransition(() => {
      setDidMount(true);
    });
  }, []);

  return didMount ? callback() : undefined;
}

/**
 * A wrapper to React's own useRef to support lazy initialization
 */
export function useLazyRef<T>(fn: () => T) {
  const ref = useRef<T>();
  if (!ref.current) ref.current = fn();
  return ref;
}

export function useInterval<T extends () => void>(callback: T, delay: number) {
  const savedCallback = useRef<T>(callback);

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    let id = setInterval(() => {
      savedCallback.current();
    }, delay);
    return () => clearInterval(id);
  }, [delay]);
}

export function useIntersectingEntry<E extends Element>(
  options?: IntersectionObserverInit
) {
  let { root, rootMargin, threshold } = options ?? {};

  let elementRef = useRef<E>(null);
  let hold = useRef(false);

  return [
    useSyncExternalStore(
      function subscribe(callback: () => void) {
        let observer = new IntersectionObserver(
          (entries: IntersectionObserverEntry[]) => {
            callback();
            hold.current = entries[0].isIntersecting;
          },
          {
            root,
            rootMargin,
            threshold,
          }
        );

        observer.observe(elementRef.current!);

        return () => {
          observer.disconnect();
        };
      },
      function getSnapshot() {
        return hold.current;
      },
      function getServerSnapshot() {
        return hold.current;
      }
    ),
    elementRef,
  ];
}

// Reusable component that also takes dependencies
export function useAnimationFrame(
  cb: (arg: { time: number; delta: number }) => void,
  deps: React.DependencyList | undefined
) {
  const frame = useRef<number>();
  const last = useRef(performance.now());
  const init = useRef(performance.now());

  const animate = () => {
    const now = performance.now();
    const time = (now - init.current) / 1000;
    const delta = (now - last.current) / 1000;
    // In seconds ~> you can do ms or anything in userland
    cb({ time, delta });
    last.current = now;
    frame.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    frame.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame.current!);
  }, deps); // Make sure to change it if the deps change
}

export default function withSuspense<
  P extends React.Attributes | null | undefined
>(Component: React.ComponentType & any, Fallback?: React.ComponentType & any) {
  return function WithSuspense(props: P) {
    return createElement(
      Suspense,
      { fallback: Fallback ? createElement(Fallback, null) : null },
      createElement(Component, props)
    );
  };
}

export const createEmitter = createNanoEvents;

export type { Emitter } from "nanoevents";

export function createEmitterContext<T extends { [event: string]: unknown }>() {
  return createContext(createNanoEvents<T>());
}
