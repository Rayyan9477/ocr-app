/**
 * Search Result Caching System
 * Implements in-memory caching for search results to improve performance
 */

import { SearchResult, SearchOptions } from './enhanced-search';

interface CacheEntry {
  results: SearchResult[];
  timestamp: number;
  query: string;
  options: SearchOptions;
  expiresAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  totalQueries: number;
  cacheSize: number;
  hitRate: number;
}

export class SearchCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    totalQueries: 0,
    cacheSize: 0,
    hitRate: 0
  };

  constructor(maxSize: number = 1000, ttlMinutes: number = 30) {
    this.maxSize = maxSize;
    this.ttl = ttlMinutes * 60 * 1000;
    
    // Cleanup expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Generate cache key from query and options
   */
  private generateKey(query: string, options: SearchOptions): string {
    const normalizedQuery = query.toLowerCase().trim();
    const optionsKey = JSON.stringify({
      fuzzyThreshold: options.fuzzyThreshold,
      includeHandwriting: options.includeHandwriting,
      minConfidence: options.minConfidence,
      maxResults: options.maxResults,
      sortBy: options.sortBy
    });
    
    return `${normalizedQuery}:${Buffer.from(optionsKey).toString('base64')}`;
  }

  /**
   * Get cached search results
   */
  get(query: string, options: SearchOptions): SearchResult[] | null {
    this.stats.totalQueries++;
    
    const key = this.generateKey(query, options);
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
    
    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
    
    this.stats.hits++;
    this.updateHitRate();
    
    // Update timestamp for LRU-like behavior
    entry.timestamp = Date.now();
    
    return entry.results;
  }

  /**
   * Store search results in cache
   */
  set(query: string, options: SearchOptions, results: SearchResult[]): void {
    const key = this.generateKey(query, options);
    const now = Date.now();
    
    const entry: CacheEntry = {
      results: [...results], // Deep copy to prevent mutation
      timestamp: now,
      query,
      options: { ...options },
      expiresAt: now + this.ttl
    };
    
    // If cache is full, remove oldest entry
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    
    this.cache.set(key, entry);
    this.stats.cacheSize = this.cache.size;
  }

  /**
   * Remove oldest cache entry (LRU eviction)
   */
  private evictOldest(): void {
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    this.stats.cacheSize = this.cache.size;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.cacheSize = 0;
  }

  /**
   * Invalidate cache entries related to a specific document
   */
  invalidateDocument(documentId: string): void {
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      // Check if any result is from the invalidated document
      const hasDocument = entry.results.some(result => 
        result.documentName === documentId || 
        result.documentId === documentId ||
        (result.documentName && result.documentName.includes(documentId))
      );
      
      if (hasDocument) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    this.stats.cacheSize = this.cache.size;
  }

  /**
   * Update hit rate statistics
   */
  private updateHitRate(): void {
    this.stats.hitRate = this.stats.totalQueries > 0 
      ? (this.stats.hits / this.stats.totalQueries) * 100 
      : 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get cache size information
   */
  getSize(): { current: number; max: number; utilization: number } {
    return {
      current: this.cache.size,
      max: this.maxSize,
      utilization: (this.cache.size / this.maxSize) * 100
    };
  }

  /**
   * Warm up cache with popular searches
   */
  async warmUp(popularQueries: Array<{ query: string; options: SearchOptions }>): Promise<void> {
    // This would be called with actual search function results
    // For now, we just prepare the structure
    console.log(`Preparing to warm up cache with ${popularQueries.length} popular queries`);
  }
}

// Singleton instance for global use
export const searchCache = new SearchCache();
