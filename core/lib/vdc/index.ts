/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-confusing-void-expression */
/* eslint-disable @typescript-eslint/consistent-type-assertions */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable no-multi-assign */
/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { InMemoryCacheHandler } from './in-memory-cache';
import { CachedRouteKind, CacheHandler, CacheHandlerContext, IncrementalCacheKind } from './types';

export interface ComputeCache<T> {
  get: (key: string) => Promise<T | undefined>;
  set: (
    key: string,
    value: any,
    options?: { tags?: string[]; revalidate?: number },
  ) => Promise<void>;
  revalidateTag: (tag: string) => Promise<void>;
}

export async function getComputeCache<T>(
  requestHeadersOverride?: Record<string, string | string[] | undefined> | Request | Headers,
): Promise<ComputeCache<T>> {
  const requestHeaders = await getCacheHeaders(getHeadersRecord(requestHeadersOverride));

  console.log('requestHeaders', JSON.stringify(requestHeaders));

  const internalCache = new FetchCacheConstructor({
    fetchCacheKeyPrefix: 'compute-cache',
    revalidatedTags: [],
    // Constructor deletes the headers, so we need to clone them
    _requestHeaders: Object.assign({}, requestHeaders) as Record<string, string>,
    maxMemoryCacheSize: 0,
  });

  internalCache.resetRequestCache();

  return {
    get: async (key: string): Promise<T | undefined> => {
      const fullKey = getKey(key);
      const content = await internalCache.get(fullKey, {
        kind: IncrementalCacheKind.FETCH,
        isFallback: false,
        fetchUrl: `https://vercel.cache/${fullKey}`,
      });

      if (content) {
        console.log('get', fullKey, content);

        const lastModified = content.lastModified;
        const revalidate = content.value?.revalidate;

        if (revalidate && lastModified && lastModified + revalidate * 1000 < Date.now()) {
          internalCache.resetRequestCache();

          return;
        }

        const value = content.value;

        if (!value) {
          return;
        }

        return JSON.parse(value.data.body);
      }
    },
    set: async (key: string, value: any, options?: { tags?: string[]; revalidate?: number }) => {
      const fullKey = getKey(key);
      const r = await internalCache.set(
        fullKey,
        {
          kind: CachedRouteKind.FETCH,
          data: {
            headers: {},
            body: JSON.stringify(value),
            url: `https://vercel.cache/${fullKey}`,
            status: 200,
          },
          // Magic tag for forever
          revalidate: options?.revalidate ?? 0xfffffffe,
        },
        {
          fetchCache: true,
          fetchUrl: `https://vercel.cache/${fullKey}`,
          revalidate: options?.revalidate,
          isFallback: false,
          tags: options?.tags,
        },
      );

      console.log('set', fullKey, value, {
        fetchCache: true,
        fetchUrl: `https://vercel.cache/${fullKey}`,
        revalidate: options?.revalidate,
        isFallback: false,
        tags: options?.tags,
      });

      // Temp hack. For some reason we cannot turn off the in-memory cache.
      if (options?.revalidate) {
        internalCache.resetRequestCache();
      }

      return r;
    },
    revalidateTag: (tag: string | string[]) => {
      const r = internalCache.revalidateTag(tag);

      internalCache.resetRequestCache();

      return r;
    },
  } as const;
}

function getHeadersRecord(
  requestHeadersOverride:
    | Record<string, string | string[] | undefined>
    | Request
    | Headers
    | undefined,
): Record<string, string | string[] | undefined> | undefined {
  if (!requestHeadersOverride) {
    return undefined;
  }

  if (requestHeadersOverride instanceof Headers) {
    return Object.fromEntries([...requestHeadersOverride.entries()]);
  }

  if (requestHeadersOverride instanceof Request) {
    return Object.fromEntries([...requestHeadersOverride.headers.entries()]);
  }

  return requestHeadersOverride;
}

let FetchCacheConstructor: new (ctx: CacheHandlerContext) => CacheHandler;

initializeComputeCache();

export function initializeComputeCache() {
  const cacheHandlersSymbol = Symbol.for('@next/cache-handlers');
  const _globalThis: typeof globalThis & {
    [cacheHandlersSymbol]?: {
      FetchCache?: new (ctx: CacheHandlerContext) => CacheHandler;
    };
  } = globalThis;
  const cacheHandlers = (_globalThis[cacheHandlersSymbol] ??= {});
  let { FetchCache } = cacheHandlers;

  if (!FetchCache) {
    FetchCache = InMemoryCacheHandler;

    if (process.env.NODE_ENV === 'production') {
      console.error('Cache handler not found');
    }
  }

  FetchCacheConstructor = FetchCache;
}

let cacheHeaders: Promise<Record<string, string>> | undefined;

async function getCacheHeadersFromDeployedFunction() {
  const r = await fetch(`https://${process.env.VERCEL_URL}/api/temp-cache-headers`, {
    cache: 'no-store',
    headers: {
      'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
    },
  });

  if (!r.ok) {
    cacheHeaders = undefined;
    throw new Error('Failed to fetch cache headers');
  }

  return r.json();
}

async function getCacheHeaders(
  requestHeaders?: Record<string, string | string[] | undefined>,
): Promise<Record<string, string | string[] | undefined>> {
  if (process.env.NODE_ENV !== 'production') {
    return {};
  }

  if (cacheHeaders) {
    return cacheHeaders;
  }

  if (requestHeaders?.['x-vercel-sc-headers']) {
    return requestHeaders;
  }

  cacheHeaders = getCacheHeadersFromDeployedFunction();

  return cacheHeaders;
}

function getKey(key: string) {
  return `compute-cache/${process.env.VERCEL_ENV || 'development'}/${key}`;
}
