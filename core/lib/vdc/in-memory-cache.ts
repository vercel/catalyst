/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable max-classes-per-file */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable no-restricted-syntax */
/* eslint-disable @typescript-eslint/consistent-type-assertions */
/* eslint-disable @typescript-eslint/require-await */
import { CacheHandler, CacheHandlerValue, IncrementalCacheValue, Revalidate } from './types';

let instance: InMemoryCacheHandlerInternal;

interface SetContext {
  revalidate?: Revalidate;
  fetchCache?: boolean;
  fetchUrl?: string;
  fetchIdx?: number;
  tags?: string[];
  isRoutePPREnabled?: boolean;
  isFallback?: boolean;
}

export class InMemoryCacheHandler implements CacheHandler {
  constructor() {
    instance = instance ?? new InMemoryCacheHandlerInternal();
  }
  get(key: string) {
    return instance.get(key);
  }
  set(key: string, data: IncrementalCacheValue | null, ctx: SetContext) {
    return instance.set(key, data, ctx);
  }
  revalidateTag(tags: string | string[]) {
    return instance.revalidateTag(tags);
  }
  resetRequestCache() {
    instance.resetRequestCache();
  }
}

class InMemoryCacheHandlerInternal implements CacheHandler {
  readonly cache: Map<
    string,
    {
      value: string;
      lastModified: number;
      tags: string[];
      revalidate: number | undefined;
    }
  >;

  constructor() {
    this.cache = new Map();
  }

  async get(key: string): Promise<CacheHandlerValue | null> {
    const content = this.cache.get(key);

    if (content?.revalidate && content.lastModified + content.revalidate * 1000 < Date.now()) {
      this.cache.delete(key);

      return null;
    }

    if (content) {
      return {
        value: JSON.parse(content.value) as IncrementalCacheValue | null,
        lastModified: content.lastModified,
        age: Date.now() - content.lastModified,
      };
    }

    return null;
  }

  async set(key: string, data: IncrementalCacheValue | null, ctx: SetContext) {
    // This could be stored anywhere, like durable storage
    this.cache.set(key, {
      value: JSON.stringify(data),
      lastModified: Date.now(),
      tags: ctx.tags || [],
      revalidate: ctx.revalidate ? ctx.revalidate : undefined,
    });
  }

  async revalidateTag(tag: string | string[]) {
    const tags = [tag].flat();

    // Iterate over all entries in the cache
    for (const [key, value] of this.cache) {
      // If the value's tags include the specified tag, delete this entry
      if (value.tags.some((tag: string) => tags.includes(tag))) {
        this.cache.delete(key);
      }
    }
  }

  resetRequestCache() {}
}
