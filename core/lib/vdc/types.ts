/* eslint-disable @typescript-eslint/consistent-type-definitions */
export interface CacheHandler {
  get(
    _cacheKey: string,
    _ctx: {
      kind: IncrementalCacheKind;
      revalidate?: Revalidate;
      fetchUrl?: string;
      fetchIdx?: number;
      tags?: string[];
      softTags?: string[];
      isRoutePPREnabled?: boolean;
      isFallback: boolean | undefined;
    },
  ): Promise<CacheHandlerValue | null>;

  set(
    cacheKey: string,
    entry: IncrementalCacheValue,
    ctx: {
      revalidate?: Revalidate;
      fetchCache?: boolean;
      fetchUrl?: string;
      fetchIdx?: number;
      tags?: string[];
      isRoutePPREnabled?: boolean;
      isFallback?: boolean;
    },
  ): Promise<void>;

  revalidateTag(tags: string | string[]): Promise<void>;

  resetRequestCache(): void;
}

type CachedFetchData = {
  headers: Record<string, string>;
  body: string;
  url: string;
  status?: number;
};

export interface IncrementalCacheValue {
  kind: CachedRouteKind.FETCH;
  data: CachedFetchData;
  // tags are only present with file-system-cache
  // fetch cache stores tags outside of cache entry
  tags?: string[];
  revalidate: number;
}

export enum CachedRouteKind {
  APP_PAGE = 'APP_PAGE',
  APP_ROUTE = 'APP_ROUTE',
  PAGES = 'PAGES',
  FETCH = 'FETCH',
  REDIRECT = 'REDIRECT',
  IMAGE = 'IMAGE',
}

export enum IncrementalCacheKind {
  APP_PAGE = 'APP_PAGE',
  APP_ROUTE = 'APP_ROUTE',
  PAGES = 'PAGES',
  FETCH = 'FETCH',
  IMAGE = 'IMAGE',
}

export interface CacheHandlerValue {
  lastModified?: number;
  age?: number;
  cacheState?: string;
  value: IncrementalCacheValue | null;
}

export interface CacheHandlerContext {
  dev?: boolean;
  flushToDisk?: boolean;
  serverDistDir?: string;
  maxMemoryCacheSize?: number;
  fetchCacheKeyPrefix?: string;
  prerenderManifest?: Record<string, unknown>;
  revalidatedTags: string[];
  _requestHeaders: Record<string, string>;
}

export type Revalidate = number | false;
