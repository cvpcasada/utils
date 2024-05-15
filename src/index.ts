export * from "@epic-web/invariant";

export function isValidHttpUrl(string: string) {
  try {
    let url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Promise wrapper around setTimeout
 */
export function delay<T>(ms: any, value?: T) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms, value);
  });
}

/** see https://github.com/sindresorhus/prepend-http */
export function prependHttp(url: string, { https = true } = {}) {
  url = url.trim();

  if (/^\.*\/|^(?!localhost)\w+?:/.test(url)) {
    return url;
  }

  return url.replace(/^(?!(?:\w+?:)?\/\/)/, https ? "https://" : "http://");
}

export function getUrlImageSize(url: string) {
  return new Promise<{
    width: number;
    height: number;
  }>((resolve, reject) => {
    const img = new Image();

    img.addEventListener("load", function () {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    });

    img.addEventListener("error", (error) => {
      reject(new Error(error.message));
    });

    img.src = url;
  });
}

export function toBase64(str: string) {
  return typeof document === "undefined"
    ? Buffer.from(str).toString("base64")
    : window.btoa(str);
}

export function escapeRegExp(string: string): string {
  return string.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

type MarkFn<T> = (part: string, matched: boolean) => T;
type AppendFn<T, P> = (accum: T, part: P) => T | null;

const defaultMark: MarkFn<string> = (part, matched) => {
  return matched ? `<mark>${part}</mark>` : part;
};

const defaultAppend: AppendFn<string, string> = (acc, part) => {
  return acc + part;
};

export function higlightWords<T, P>(
  textToHighlight: string,
  searchTerm: string,
  options?: {
    caseSensitive?: boolean;
    mark?: MarkFn<T>;
    append?: AppendFn<T, P>;
  },
) {
  let {
    caseSensitive = true,
    mark = defaultMark,
    append = defaultAppend,
  } = options ?? {};

  let ranges: number[] = [];
  let regex = new RegExp(
    escapeRegExp(searchTerm).replace(" ", "|"),
    caseSensitive ? "g" : "gi",
  );

  let match: RegExpExecArray | null;
  while ((match = regex.exec(textToHighlight))) {
    let start = match.index;
    let end = regex.lastIndex;
    // We do not return zero-length matches
    if (end > start) {
      ranges.push(start);
      ranges.push(end);
    }

    // See http://www.regexguru.com/2008/04/watch-out-for-zero-length-matches/
    if (match.index === regex.lastIndex) {
      regex.lastIndex++;
    }
  }

  return highlight(textToHighlight, ranges, mark, "", append);
}

function highlight(
  str: string,
  ranges: number[],
  mark: MarkFn<any | any> = defaultMark,
  accum: any = "",
  append: AppendFn<any, any> = defaultAppend,
) {
  accum = append(accum, mark(str.substring(0, ranges[0]), false)) ?? accum;

  for (let i = 0; i < ranges.length; i += 2) {
    let fr = ranges[i]!;
    let to = ranges[i + 1];

    accum = append(accum, mark(str.substring(fr, to), true)) ?? accum;

    if (i < ranges.length - 3)
      accum =
        append(
          accum,
          mark(str.substring(ranges[i + 1]!, ranges[i + 2]), false),
        ) ?? accum;
  }

  accum =
    append(accum, mark(str.substring(ranges[ranges.length - 1]!), false)) ??
    accum;

  return accum;
}

export function debounce<F extends Function>(func: F, timeout: number) {
  let timeoutId: number;

  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => func(...args), timeout);
  }) as unknown as F;
}

export function debounceAnimationFrame<F extends Function>(func: F) {
  let raf: number;

  return function (...args: any[]) {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(func.bind(func, ...args));
  } as unknown as F;
}

export const noop = (): null => null;
