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

  return url.replace(/^(?!(?:\w+?:)?\/\/)/, https ? 'https://' : 'http://');
}

export function getUrlImageSize(url: string) {
  return new Promise<{
    width: number;
    height: number;
  }>((resolve, reject) => {
    const img = new Image();

    img.addEventListener('load', function () {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    });

    img.addEventListener('error', (error) => {
      reject(new Error(error.message));
    });

    img.src = url;
  });
}

export function toBase64(str: string) {
  return typeof document === 'undefined'
    ? Buffer.from(str).toString('base64')
    : window.btoa(str);
}
