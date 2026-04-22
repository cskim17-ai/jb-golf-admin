/**
 * 클라이언트 캐싱 전략
 * 자주 조회되는 데이터를 메모리에 캐시하여 Firebase 읽기 작업 최소화
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class Cache {
  private store = new Map<string, CacheEntry<any>>();

  /**
   * 캐시에 데이터 저장
   * @param key 캐시 키
   * @param data 저장할 데이터
   * @param ttl 캐시 유효시간 (밀리초, 기본값: 5분)
   */
  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    this.store.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * 캐시에서 데이터 조회
   * @param key 캐시 키
   * @returns 캐시된 데이터 또는 null
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    
    if (!entry) {
      return null;
    }

    // 캐시 만료 확인
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * 캐시 삭제
   * @param key 캐시 키
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * 모든 캐시 삭제
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * 캐시 상태 확인
   */
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;

    // 캐시 만료 확인
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 캐시 크기 반환
   */
  size(): number {
    return this.store.size;
  }
}

// 전역 캐시 인스턴스
export const globalCache = new Cache();

/**
 * 골프장 목록 캐시 키
 */
export const CACHE_KEYS = {
  GOLF_COURSES: 'golf_courses',
  GALLERY_TOPICS: 'gallery_topics',
  VIDEO_TOPICS: 'video_topics',
  NOTICES: 'notices',
  GOLFER_QUOTES: 'golfer_quotes',
  BOOKING_REQUESTS: 'booking_requests',
  QUOTES: 'quotes',
  CHATTING_DATA: 'chatting_data'
} as const;

/**
 * 캐시 유효시간 설정 (밀리초)
 */
export const CACHE_TTL = {
  SHORT: 1 * 60 * 1000,      // 1분
  MEDIUM: 5 * 60 * 1000,     // 5분
  LONG: 15 * 60 * 1000,      // 15분
  VERY_LONG: 60 * 60 * 1000  // 1시간
} as const;

/**
 * 캐시 관리 유틸리티
 */
export const cacheUtils = {
  /**
   * 데이터 캐시 또는 조회
   */
  getOrSet: async <T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = CACHE_TTL.MEDIUM
  ): Promise<T> => {
    // 캐시에서 먼저 조회
    const cached = globalCache.get<T>(key);
    if (cached) {
      console.log(`[Cache Hit] ${key}`);
      return cached;
    }

    // 캐시 미스: 데이터 조회
    console.log(`[Cache Miss] ${key}`);
    const data = await fetcher();
    
    // 데이터 캐시
    globalCache.set(key, data, ttl);
    
    return data;
  },

  /**
   * 캐시 무효화
   */
  invalidate: (key: string): void => {
    globalCache.delete(key);
    console.log(`[Cache Invalidated] ${key}`);
  },

  /**
   * 여러 캐시 무효화
   */
  invalidateMultiple: (keys: string[]): void => {
    keys.forEach(key => globalCache.delete(key));
    console.log(`[Cache Invalidated] ${keys.join(', ')}`);
  },

  /**
   * 모든 캐시 무효화
   */
  invalidateAll: (): void => {
    globalCache.clear();
    console.log('[Cache Cleared] All caches invalidated');
  }
};
