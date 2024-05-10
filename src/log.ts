const noop = () => {};

const logMethods = ["trace", "debug", "info", "log", "warn", "error"] as const;

const STORAGE_KEY = "loglevel";

let defaultLevel: LogMethod = "trace";
try {
  defaultLevel = localStorage.getItem(STORAGE_KEY) as LogMethod;
} catch {}

type LogMethod = (typeof logMethods)[number];

function createHandler(
  level?: LogMethod,
  applyBind?: (level: LogMethod) => Parameters<(typeof console)[LogMethod]>,
  applyCallback?: (
    method: LogMethod,
    args: Parameters<(typeof console)[LogMethod]>
  ) => void
): ProxyHandler<Console> {
  level = level ?? getDefaultLevel();

  return {
    get: (target, prop, receiver) => {
      let index = logMethods.indexOf(prop as LogMethod);

      if (index >= logMethods.indexOf(level)) {
        let method = Reflect.get(target, prop, receiver);

        if (applyBind) {
          method = method.bind(undefined, ...applyBind(prop as LogMethod));
        }

        if (applyCallback) {
          return new Proxy(method, {
            apply: (target, thisArg, args) => {
              applyCallback(prop as LogMethod, args);
              return Reflect.apply(target, thisArg, args);
            },
          });
        }

        return method;
      }

      return noop;
    },
  };
}

const ColorMap = {
  trace: "#95bdb7",
  debug: "#ad95b8",
  info: "#b6bd73",
  log: "#88a1bb",
  warn: "#e9c880",
  error: "#bf6c69",
} as { readonly [key in LogMethod]: string };

export function createLogger(
  name: string,
  options: {
    level?: LogMethod;
    applyCallback?: (
      method: LogMethod,
      args: Parameters<(typeof console)[LogMethod]>
    ) => void;
    showLevel?: boolean;
  } = {
    level: defaultLevel,
    showLevel: true,
  }
) {
  // todo: check if we can have a global here and if a bundler tree shakes it
  let bindArgs = (level: LogMethod) => [
    `%c${options.showLevel ? level.toLocaleUpperCase() : ""}[${name}]%c`,
    `color: ${ColorMap[level]}; font-weight: bold;`,
    `color: inherit;`,
  ];

  return new Proxy(
    console,
    createHandler(options.level, bindArgs, options.applyCallback)
  );
}

export const log = new Proxy(console, createHandler());

export function setDefaultLevel(level: LogMethod) {
  defaultLevel = level;
  try {
    localStorage.setItem(STORAGE_KEY, level);
  } catch {}
}

export function getDefaultLevel() {
  try {
    return (localStorage.getItem(STORAGE_KEY) as LogMethod) ?? defaultLevel;
  } catch {
    return defaultLevel;
  }
}
