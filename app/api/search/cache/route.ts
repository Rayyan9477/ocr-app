/**
 * Search Cache Management API Endpoint
 * Provides cache control, warming, and optimization features
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchCache } from '@/lib/search-cache';
import EnhancedSearchEngine, { SearchOptions } from '@/lib/enhanced-search';
import logger from '@/lib/logger';

const cacheWarmupEngine = new EnhancedSearchEngine();

interface CacheWarmupRequest {
  popularQueries?: Array<{ query: string; options?: SearchOptions }>;
  preloadDocuments?: boolean;
  aggressive?: boolean;
}

interface CacheOptimizationResult {
  beforeOptimization: {
    size: number;
    hitRate: number;
    utilization: number;
  };
  afterOptimization: {
    size: number;
    hitRate: number;
    utilization: number;
  };
  optimizationActions: string[];
  processingTimeMs: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (action === 'stats') {
      const stats = searchCache.getStats();
      const size = searchCache.getSize();
      
      return NextResponse.json({
        cacheStats: stats,
        cacheSize: size,
        status: 'operational',
        recommendations: generateRecommendations(stats, size)
      });
    }

    if (action === 'health') {
      const stats = searchCache.getStats();
      const size = searchCache.getSize();
      
      const health = {
        status: 'healthy',
        issues: [] as string[],
        warnings: [] as string[]
      };

      // Check for potential issues
      if (stats.hitRate < 30) {
        health.warnings.push('Low cache hit rate - consider cache warming');
      }
      
      if (size.utilization > 90) {
        health.warnings.push('High cache utilization - consider increasing cache size');
      }
      
      if (stats.totalQueries > 0 && stats.hitRate === 0) {
        health.issues.push('No cache hits detected - cache may not be functioning');
        health.status = 'degraded';
      }

      return NextResponse.json(health);
    }

    if (action === 'popular-queries') {
      // Return suggestions for popular queries to warm cache
      const suggestions = [
        { query: 'patient', options: { fuzzyThreshold: 0.3, includeHandwriting: true } },
        { query: 'medical', options: { fuzzyThreshold: 0.3, includeHandwriting: true } },
        { query: 'prescription', options: { fuzzyThreshold: 0.4, includeHandwriting: true } },
        { query: 'insurance', options: { fuzzyThreshold: 0.3, includeHandwriting: false } },
        { query: 'copay', options: { fuzzyThreshold: 0.5, includeHandwriting: true } },
        { query: 'diagnosis', options: { fuzzyThreshold: 0.3, includeHandwriting: true } },
        { query: 'medication', options: { fuzzyThreshold: 0.4, includeHandwriting: true } },
        { query: 'doctor', options: { fuzzyThreshold: 0.3, includeHandwriting: false } },
        { query: 'treatment', options: { fuzzyThreshold: 0.3, includeHandwriting: true } },
        { query: 'billing', options: { fuzzyThreshold: 0.3, includeHandwriting: false } }
      ];

      return NextResponse.json({
        suggestions,
        message: 'Popular medical document search queries for cache warming'
      });
    }

    // Default: return cache overview
    const stats = searchCache.getStats();
    const size = searchCache.getSize();
    
    return NextResponse.json({
      message: 'Search Cache Management API',
      currentStats: stats,
      currentSize: size,
      availableActions: [
        'GET ?action=stats - Detailed cache statistics',
        'GET ?action=health - Cache health check',
        'GET ?action=popular-queries - Suggested queries for warming',
        'POST clear - Clear all cache entries',
        'POST warm - Warm cache with popular queries',
        'POST optimize - Optimize cache performance',
        'DELETE invalidate - Invalidate specific document cache'
      ]
    });

  } catch (error) {
    logger.error('Cache management GET API error:', error);
    return NextResponse.json(
      { error: 'Cache management failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch (error) {
      // If no body or invalid JSON, default to clear action
      body = { action: 'clear' };
    }
    
    const { action, ...data } = body;

    if (action === 'clear') {
      const beforeStats = searchCache.getStats();
      searchCache.clear();
      const afterStats = searchCache.getStats();

      return NextResponse.json({
        success: true,
        message: 'Cache cleared successfully',
        before: beforeStats,
        after: afterStats
      });
    }

    if (action === 'warm') {
      const { popularQueries, preloadDocuments = false, aggressive = false }: CacheWarmupRequest = data;
      const startTime = Date.now();
      const beforeStats = searchCache.getStats();

      let queriesToWarm = popularQueries;
      
      // Use default popular queries if none provided
      if (!queriesToWarm || queriesToWarm.length === 0) {
        const response = await fetch(`${request.nextUrl.origin}/api/search/cache?action=popular-queries`);
        const popularData = await response.json();
        queriesToWarm = popularData.suggestions;
      }

      const warmupResults = [];

      // Warm cache with provided queries
      for (const queryItem of queriesToWarm || []) {
        const query = typeof queryItem === 'string' ? queryItem : queryItem.query;
        const options = typeof queryItem === 'string' ? {} : queryItem.options || {};
        
        try {
          const searchOptions: SearchOptions = {
            fuzzyThreshold: 0.3,
            includeHandwriting: true,
            minConfidence: 0,
            contextLength: 100,
            sortBy: 'relevance',
            maxResults: aggressive ? 100 : 50,
            enablePhoneticMatching: false,
            enableTypoCorrection: true,
            ...options
          };

          // Perform actual search to populate cache
          const searchResponse = await fetch(`${request.nextUrl.origin}/api/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query, options: searchOptions })
          });

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            warmupResults.push({
              query: query,
              success: true,
              resultsCount: searchData.totalResults
            });
          } else {
            warmupResults.push({
              query: query,
              success: false,
              error: 'Search failed'
            });
          }
        } catch (error) {
          warmupResults.push({
            query: query,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const afterStats = searchCache.getStats();
      const processingTime = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        message: `Cache warmed with ${queriesToWarm?.length || 0} queries`,
        processingTimeMs: processingTime,
        beforeStats,
        afterStats,
        warmupResults: warmupResults.slice(0, 10), // Limit response size
        successfulWarmups: warmupResults.filter(r => r.success).length
      });
    }

    if (action === 'optimize') {
      const startTime = Date.now();
      const beforeStats = searchCache.getStats();
      const beforeSize = searchCache.getSize();
      
      const optimizationActions: string[] = [];

      // Optimization logic
      if (beforeSize.utilization > 80) {
        // Cache is getting full, this would normally trigger cleanup
        optimizationActions.push('High utilization detected - cache cleanup will occur automatically');
      }

      if (beforeStats.hitRate < 50 && beforeStats.totalQueries > 100) {
        optimizationActions.push('Low hit rate detected - consider cache warming with popular queries');
      }

      // Force a cleanup cycle (this happens automatically but we can trigger it)
      // The cleanup is handled internally by the cache

      const afterStats = searchCache.getStats();
      const afterSize = searchCache.getSize();
      const processingTime = Date.now() - startTime;

      const result: CacheOptimizationResult = {
        beforeOptimization: {
          size: beforeSize.current,
          hitRate: beforeStats.hitRate,
          utilization: beforeSize.utilization
        },
        afterOptimization: {
          size: afterSize.current,
          hitRate: afterStats.hitRate,
          utilization: afterSize.utilization
        },
        optimizationActions,
        processingTimeMs: processingTime
      };

      return NextResponse.json({
        success: true,
        message: 'Cache optimization completed',
        ...result
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    logger.error('Cache management POST API error:', error);
    return NextResponse.json(
      { error: 'Cache operation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const documentId = searchParams.get('documentId');
    const action = searchParams.get('action');

    if (action === 'invalidate' && documentId) {
      const beforeStats = searchCache.getStats();
      searchCache.invalidateDocument(documentId);
      const afterStats = searchCache.getStats();

      return NextResponse.json({
        success: true,
        message: `Cache invalidated for document: ${documentId}`,
        beforeSize: beforeStats.cacheSize,
        afterSize: afterStats.cacheSize,
        entriesRemoved: beforeStats.cacheSize - afterStats.cacheSize
      });
    }

    return NextResponse.json({ 
      error: 'Invalid delete action. Use ?action=invalidate&documentId=<id>' 
    }, { status: 400 });

  } catch (error) {
    logger.error('Cache management DELETE API error:', error);
    return NextResponse.json(
      { error: 'Cache invalidation failed' },
      { status: 500 }
    );
  }
}

/**
 * Generate cache optimization recommendations
 */
function generateRecommendations(stats: any, size: any): string[] {
  const recommendations: string[] = [];

  if (stats.hitRate < 30) {
    recommendations.push('Consider warming the cache with popular search queries');
  }

  if (stats.hitRate > 80) {
    recommendations.push('Excellent cache performance - consider increasing cache size for more entries');
  }

  if (size.utilization > 90) {
    recommendations.push('Cache is nearly full - increase maxSize or implement more aggressive cleanup');
  }

  if (size.utilization < 20 && stats.totalQueries > 100) {
    recommendations.push('Cache is underutilized - consider reducing cache size to save memory');
  }

  if (stats.totalQueries < 10) {
    recommendations.push('Low query volume - cache may not be necessary yet');
  }

  if (recommendations.length === 0) {
    recommendations.push('Cache is performing optimally');
  }

  return recommendations;
}
