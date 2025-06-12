/**
 * Search Analytics API Endpoint
 * Provides search trend analysis, performance metrics, and usage statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { searchCache } from '@/lib/search-cache';
import logger from '@/lib/logger';

interface SearchAnalytics {
  searchTrends: {
    popularQueries: Array<{ query: string; count: number; lastSearched: string }>;
    searchVolume: Array<{ date: string; searches: number }>;
    averageResultsPerSearch: number;
    topDocuments: Array<{ document: string; searchCount: number }>;
  };
  performanceMetrics: {
    averageSearchTime: number;
    cacheHitRate: number;
    totalSearches: number;
    totalCacheHits: number;
    memoryUsage: {
      cacheSize: number;
      maxCacheSize: number;
      utilization: number;
    };
  };
  userBehavior: {
    mostSearchedTerms: string[];
    searchPatterns: Array<{ pattern: string; frequency: number }>;
    timeDistribution: Array<{ hour: number; searches: number }>;
  };
  qualityMetrics: {
    averageConfidence: number;
    handwritingDetectionRate: number;
    correctionRate: number;
    lowConfidenceQueries: Array<{ query: string; avgConfidence: number }>;
  };
}

interface SearchLogEntry {
  timestamp: string;
  query: string;
  resultsCount: number;
  searchTime: number;
  cached: boolean;
  avgConfidence: number;
  hasHandwriting: boolean;
  documentCount: number;
}

// In-memory analytics store (in production, use Redis or database)
class AnalyticsStore {
  private searchLogs: SearchLogEntry[] = [];
  private queryFrequency: Map<string, number> = new Map();
  private documentHits: Map<string, number> = new Map();
  private hourlyDistribution: Map<number, number> = new Map();
  
  constructor() {
    this.loadFromFile();
  }

  logSearch(entry: SearchLogEntry) {
    this.searchLogs.push(entry);
    
    // Update frequency counters
    const currentCount = this.queryFrequency.get(entry.query) || 0;
    this.queryFrequency.set(entry.query, currentCount + 1);
    
    // Update hourly distribution
    const hour = new Date(entry.timestamp).getHours();
    const hourCount = this.hourlyDistribution.get(hour) || 0;
    this.hourlyDistribution.set(hour, hourCount + 1);
    
    // Keep only last 10000 entries
    if (this.searchLogs.length > 10000) {
      this.searchLogs = this.searchLogs.slice(-10000);
    }
    
    // Periodically save to file
    if (this.searchLogs.length % 100 === 0) {
      this.saveToFile();
    }
  }

  getAnalytics(): SearchAnalytics {
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentLogs = this.searchLogs.filter(log => new Date(log.timestamp) > last7Days);
    
    return {
      searchTrends: this.getSearchTrends(recentLogs),
      performanceMetrics: this.getPerformanceMetrics(recentLogs),
      userBehavior: this.getUserBehavior(recentLogs),
      qualityMetrics: this.getQualityMetrics(recentLogs)
    };
  }

  private getSearchTrends(logs: SearchLogEntry[]) {
    // Popular queries
    const queryCount = new Map<string, { count: number; lastSearched: string }>();
    logs.forEach(log => {
      const existing = queryCount.get(log.query) || { count: 0, lastSearched: log.timestamp };
      queryCount.set(log.query, {
        count: existing.count + 1,
        lastSearched: log.timestamp > existing.lastSearched ? log.timestamp : existing.lastSearched
      });
    });

    const popularQueries = Array.from(queryCount.entries())
      .map(([query, data]) => ({ query, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Search volume by day
    const dailyVolume = new Map<string, number>();
    logs.forEach(log => {
      const date = log.timestamp.split('T')[0];
      dailyVolume.set(date, (dailyVolume.get(date) || 0) + 1);
    });

    const searchVolume = Array.from(dailyVolume.entries())
      .map(([date, searches]) => ({ date, searches }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Average results per search
    const totalResults = logs.reduce((sum, log) => sum + log.resultsCount, 0);
    const averageResultsPerSearch = logs.length > 0 ? totalResults / logs.length : 0;

    return {
      popularQueries,
      searchVolume,
      averageResultsPerSearch,
      topDocuments: Array.from(this.documentHits.entries())
        .map(([document, searchCount]) => ({ document, searchCount }))
        .sort((a, b) => b.searchCount - a.searchCount)
        .slice(0, 10)
    };
  }

  private getPerformanceMetrics(logs: SearchLogEntry[]) {
    const cacheStats = searchCache.getStats();
    const cacheSize = searchCache.getSize();
    
    const totalSearchTime = logs.reduce((sum, log) => sum + log.searchTime, 0);
    const averageSearchTime = logs.length > 0 ? totalSearchTime / logs.length : 0;
    
    const cachedSearches = logs.filter(log => log.cached).length;
    const cacheHitRate = logs.length > 0 ? (cachedSearches / logs.length) * 100 : 0;

    return {
      averageSearchTime,
      cacheHitRate,
      totalSearches: logs.length,
      totalCacheHits: cachedSearches,
      memoryUsage: {
        cacheSize: cacheSize.current,
        maxCacheSize: cacheSize.max,
        utilization: cacheSize.utilization
      }
    };
  }

  private getUserBehavior(logs: SearchLogEntry[]) {
    // Most searched terms
    const termFrequency = new Map<string, number>();
    logs.forEach(log => {
      const terms = log.query.toLowerCase().split(/\s+/);
      terms.forEach(term => {
        if (term.length > 2) { // Ignore very short terms
          termFrequency.set(term, (termFrequency.get(term) || 0) + 1);
        }
      });
    });

    const mostSearchedTerms = Array.from(termFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([term]) => term);

    // Search patterns (common query structures)
    const patternFrequency = new Map<string, number>();
    logs.forEach(log => {
      const pattern = this.extractSearchPattern(log.query);
      patternFrequency.set(pattern, (patternFrequency.get(pattern) || 0) + 1);
    });

    const searchPatterns = Array.from(patternFrequency.entries())
      .map(([pattern, frequency]) => ({ pattern, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);

    // Time distribution
    const timeDistribution = Array.from(this.hourlyDistribution.entries())
      .map(([hour, searches]) => ({ hour, searches }))
      .sort((a, b) => a.hour - b.hour);

    return {
      mostSearchedTerms,
      searchPatterns,
      timeDistribution
    };
  }

  private getQualityMetrics(logs: SearchLogEntry[]) {
    const confidenceSum = logs.reduce((sum, log) => sum + log.avgConfidence, 0);
    const averageConfidence = logs.length > 0 ? confidenceSum / logs.length : 0;
    
    const handwritingSearches = logs.filter(log => log.hasHandwriting).length;
    const handwritingDetectionRate = logs.length > 0 ? (handwritingSearches / logs.length) * 100 : 0;
    
    // Assuming correction rate is related to low confidence results
    const lowConfidenceSearches = logs.filter(log => log.avgConfidence < 70).length;
    const correctionRate = logs.length > 0 ? (lowConfidenceSearches / logs.length) * 100 : 0;

    // Low confidence queries
    const queryConfidence = new Map<string, number[]>();
    logs.forEach(log => {
      if (!queryConfidence.has(log.query)) {
        queryConfidence.set(log.query, []);
      }
      queryConfidence.get(log.query)!.push(log.avgConfidence);
    });

    const lowConfidenceQueries = Array.from(queryConfidence.entries())
      .map(([query, confidences]) => ({
        query,
        avgConfidence: confidences.reduce((a, b) => a + b, 0) / confidences.length
      }))
      .filter(item => item.avgConfidence < 70)
      .sort((a, b) => a.avgConfidence - b.avgConfidence)
      .slice(0, 10);

    return {
      averageConfidence,
      handwritingDetectionRate,
      correctionRate,
      lowConfidenceQueries
    };
  }

  private extractSearchPattern(query: string): string {
    // Simple pattern extraction
    if (query.includes('"')) return 'Exact phrase search';
    if (query.includes(' AND ') || query.includes(' OR ')) return 'Boolean search';
    if (query.split(' ').length === 1) return 'Single term';
    if (query.split(' ').length <= 3) return 'Short phrase';
    return 'Long query';
  }

  private loadFromFile() {
    try {
      const logsDir = path.join(process.cwd(), 'logs');
      const filePath = path.join(logsDir, 'search-analytics.json');
      
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        this.searchLogs = data.searchLogs || [];
        this.queryFrequency = new Map(data.queryFrequency || []);
        this.documentHits = new Map(data.documentHits || []);
        this.hourlyDistribution = new Map(data.hourlyDistribution || []);
      }
    } catch (error) {
      logger.error(`Error loading analytics from file: ${error}`);
    }
  }

  private saveToFile() {
    try {
      const logsDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      const filePath = path.join(logsDir, 'search-analytics.json');
      const data = {
        searchLogs: this.searchLogs.slice(-5000), // Keep last 5000 entries
        queryFrequency: Array.from(this.queryFrequency.entries()),
        documentHits: Array.from(this.documentHits.entries()),
        hourlyDistribution: Array.from(this.hourlyDistribution.entries())
      };
      
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error(`Error saving analytics to file: ${error}`);
    }
  }
}

const analyticsStore = new AnalyticsStore();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const timeframe = searchParams.get('timeframe') || '7d';

    if (action === 'log') {
      // Log a search entry (called by search APIs)
      const query = searchParams.get('query');
      const resultsCount = parseInt(searchParams.get('resultsCount') || '0');
      const searchTime = parseFloat(searchParams.get('searchTime') || '0');
      const cached = searchParams.get('cached') === 'true';
      const avgConfidence = parseFloat(searchParams.get('avgConfidence') || '0');
      const hasHandwriting = searchParams.get('hasHandwriting') === 'true';
      const documentCount = parseInt(searchParams.get('documentCount') || '0');

      if (query) {
        analyticsStore.logSearch({
          timestamp: new Date().toISOString(),
          query,
          resultsCount,
          searchTime,
          cached,
          avgConfidence,
          hasHandwriting,
          documentCount
        });
      }

      return NextResponse.json({ success: true, message: 'Search logged' });
    }

    if (action === 'export') {
      const analytics = analyticsStore.getAnalytics();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      const response = new NextResponse(JSON.stringify(analytics, null, 2));
      response.headers.set('Content-Type', 'application/json');
      response.headers.set('Content-Disposition', `attachment; filename="search-analytics-${timestamp}.json"`);
      return response;
    }

    // Default: return analytics dashboard data
    const analytics = analyticsStore.getAnalytics();
    
    return NextResponse.json({
      ...analytics,
      generatedAt: new Date().toISOString(),
      timeframe
    });

  } catch (error) {
    logger.error(`Analytics API error: ${error}`);
    return NextResponse.json(
      { error: 'Analytics fetch failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { action?: string; query?: string; resultsCount?: number; searchTime?: number; cached?: boolean; avgConfidence?: number; hasHandwriting?: boolean; documentCount?: number; };
    const { action, ...data } = body;

    if (action === 'log-search') {
      analyticsStore.logSearch({
        timestamp: new Date().toISOString(),
        query: data.query || '',
        resultsCount: data.resultsCount || 0,
        searchTime: data.searchTime || 0,
        cached: data.cached || false,
        avgConfidence: data.avgConfidence || 0,
        hasHandwriting: data.hasHandwriting || false,
        documentCount: data.documentCount || 0,
        ...data
      });

      return NextResponse.json({ success: true, message: 'Search logged successfully' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    logger.error(`Analytics POST API error: ${error}`);
    return NextResponse.json(
      { error: 'Analytics update failed' },
      { status: 500 }
    );
  }
}
