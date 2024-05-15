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
  type EffectCallback,
  type DependencyList,
} from "react";

import { dequal as equals } from "dequal/lite";
export { default as useMediaQuery } from "./useMediaQuery.js";

type Fn<A extends any[], R> = (...args: A) => R;
type AnyFn<R> = Fn<any[], R>;

const defaultIsEqual = (a: unknown, b: unknown) => a === b;

/**
 * React hook for creating a value exactly once. useMemo doesn't give this guarantee unfortunately
 * see https://github.com/Andarist/use-constant
 */
export function useConstant<T>(input: T | (() => T)): T {
  let ref = useRef<{ v: T }>();

  if (!ref.current) {
    ref.current = {
      v: typeof input === "function" ? (input as () => T)() : input,
    };
  }

  return ref.current.v;
}

/**
 * Runs an effect based on changes in dependencies while also accessing their previous values.
 */
export function usePreviousEffect<Args extends DependencyList>(
  effect: (args: Args) => void | (() => void),
  inputs: Args
) {
  let previousInputsRef = useRef<Args>(inputs);

  useEffect(() => {
    let result = effect(previousInputsRef.current);
    previousInputsRef.current = inputs;

    return result;
  }, inputs);
}

/**
 * Runs an effect when a provided dependency has changed
 * replaces useUpdateEffect
 */
export function useHasChangedEffect(
  effect: EffectCallback,
  deps: DependencyList,
  equal = defaultIsEqual
) {
  usePreviousEffect((previousDeps) => {
    let hasChanged = false;

    if (previousDeps.length !== deps.length) {
      console.warn("number of dependencies has changed");
      hasChanged = true;
    } else {
      for (let i = 0; i < deps.length; i++) {
        hasChanged = hasChanged || !equal(previousDeps[i], deps[i]);
        if (hasChanged) break;
      }
    }

    if (hasChanged) return effect();
  }, deps);
}

/**
 * Returns the last stored value when given a new input value
 */
export function usePrevious<T>(value: T): T | null {
  let [[current, previus], set] = useState<[T, T | null]>([value, null]);

  if (value !== current) {
    set([value, current]);
  }

  return previus;
}

/**
 * Returns true if the value has changed since the last render
 */
export function useHasChanged<T>(value: T) {
  let prev = usePrevious(value);

  return prev !== null && prev !== value;
}

/**
 * A Hook to define an event handler with an always-stable function identity. Aimed to be easier to use than useCallback.
 * useEffectEvent (experimental) instead if event is only used as part of useEffect logic.
 * See https://react.dev/learn/separating-events-from-effects#declaring-an-effect-event
 */
export function useEvent<A extends any[], R>(callback: Fn<A, R>): Fn<A, R> {
  let ref = useRef({
    stable: (...args: A) => ref.current.callback(...args),
    callback,
  });

  useLayoutEffect(() => {
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
export function useAsyncCallback() {
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
 * @deprecated do not use with React 19
 *
 * Effects that should run only once
 * https://github.com/reactwg/react-18/discussions/18#discussion-3385714
 */
export function useEffectOnce(effectCb: React.EffectCallback) {
  let calledOnce = useRef(false);

  useEffect(() => {
    if (calledOnce.current === false) {
      calledOnce.current = true;

      return effectCb();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * @deprecated do not use with React 19
 *
 * A modified version of useEffect that is skipping the first render.
 */
export function useUpdateEffect(
  effect: React.EffectCallback,
  deps?: React.DependencyList
) {
  let isFirst = useIsFirstRender();

  useEffect(() => {
    if (!isFirst) {
      return effect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * @deprecated do not use with React 19
 *
 * Simple React hook that return a boolean
 * @returns True at the mount time, Then always false
 */
export function useIsFirstRender(): boolean {
  let isFirst = useRef(true);
  return isFirst.current ? !(isFirst.current = false) : false;
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
  let ref = useRef<{ key: TKey; value: TValue }>();

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
 * Returns a function that can be used to force a re-render
 */
export function useForceUpdate() {
  let [key, setKey] = useState<React.Key>(0);
  return [key, () => setKey((k) => Number(k) + 1)] as const;
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
    ([entry]) => setIsIntersecting(entry?.isIntersecting ?? false),
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
      if (entry?.isIntersecting) {
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
  let [count, setCount] = useState(initialValue || 0);

  let increment = () => setCount((x) => x + 1);
  let decrement = () => setCount((x) => x - 1);
  let reset = () => setCount(initialValue || 0);

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
  let [didMount, setDidMount] = useState(false);

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
  let ref = useRef<T>();
  if (!ref.current) ref.current = fn();
  return ref;
}

export function useInterval<T extends () => void>(callback: T, delay: number) {
  let savedCallback = useRef<T>(callback);

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
          ([entry]: IntersectionObserverEntry[]) => {
            if (!entry) return;
            callback();
            hold.current = entry.isIntersecting;
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
  ] as const;
}

// Reusable component that also takes dependencies
export function useAnimationFrame(
  cb: (arg: { time: number; delta: number }) => void,
  deps: React.DependencyList | undefined
) {
  let frame = useRef<number>();
  let last = useRef(performance.now());
  let init = useRef(performance.now());

  let animate = () => {
    let now = performance.now();
    let time = (now - init.current) / 1000;
    let delta = (now - last.current) / 1000;
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

/**
 *  Dynamically measure the size of a given HTML element and update CSS custom properties accordingly
 */
export function useStyleMeasure<T extends HTMLElement>(
  prefix: string = "container"
) {
  let ref = useRef<T>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;

    let htmlEl = ref.current;

    let oberver = new ResizeObserver(([entry]) => {
      if (!entry) return;
      let {
        contentRect: { width, height },
      } = entry;

      htmlEl.style.setProperty(`--${prefix}-width`, width.toString());
      htmlEl.style.setProperty(`--${prefix}-height`, height.toString());
    });

    if (htmlEl) {
      oberver.observe(htmlEl);
    }

    return () => {
      oberver?.disconnect();
    };
  }, [prefix]);

  return ref;
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
    let res = useHook(...((args ?? []) as A));
    return children(res);
  };
}

export function withSuspense<
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
