/* eslint-disable no-async-promise-executor */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/no-misused-promises */
export async function credentialsFromFetch(headers: Headers) {
  return new Promise<Record<string, string>>(async (resolve, reject) => {
    if (process.env.NODE_ENV !== 'production') {
      resolve({});

      return;
    }

    const host = headers.get('x-vercel-sc-host');

    if (!host) {
      reject(new Error('Missing x-vercel-sc-host header'));
    }

    const basepath = headers.get('x-vercel-sc-basepath');
    const original = globalThis.fetch;
    const sentinelUrl = `https://vercel.com/robots.txt?id=${Math.random()}`;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      if (!input.toString().startsWith(`https://${host}/`)) {
        return original(input, init);
      }

      const h = new Headers(init?.headers);
      const url = h.get('x-vercel-cache-item-name');

      if (url !== sentinelUrl) {
        return original(input, init);
      }

      console.log('h', input, url, h);

      const authorization = h.get('authorization');

      if (!authorization) {
        reject(new Error('Missing cache authorization header'));
      }

      resolve({
        'x-vercel-sc-headers': JSON.stringify({
          authorization: h.get('authorization'),
        }),
        'x-vercel-sc-host': host || '',
        'x-vercel-sc-basepath': basepath || '',
      });
      globalThis.fetch = original;

      return new Response(JSON.stringify({}), {
        status: 510,
      });
    };

    try {
      await fetch(sentinelUrl, {
        cache: 'force-cache',
      });
    } catch (e) {
      console.info(e);
    }
  });
}
