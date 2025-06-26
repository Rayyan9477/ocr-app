"use client"

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { 
  Search, 
  Settings, 
  FileText, 
  Eye, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  SlidersHorizontal,
  SortAsc,
  Zap,
  Brain,
  Target,
  BookOpen,
  Download,
  BarChart3,
  Database,
  Layers,
  Filter
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface SearchResult {
  text: string
  confidence: number
  page: number
  matchScore: number
  boundingBox?: {
    x0: number
    y0: number
    x1: number
    y1: number
  }
  context?: string
  isHandwritten?: boolean
  qualityScore?: number
  documentName?: string
  documentId?: string
}

interface SearchOptions {
  fuzzyThreshold: number
  includeHandwriting: boolean
  minConfidence: number
  contextLength: number
  sortBy: 'relevance' | 'confidence' | 'page'
  maxResults: number
  enablePhoneticMatching: boolean
  enableTypoCorrection: boolean
}

interface SmartSearchProps {
  className?: string
  onResultSelect?: (result: SearchResult) => void
  initialQuery?: string
}

export function SmartSearch({ className, onResultSelect, initialQuery = "" }: SmartSearchProps) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [searchStats, setSearchStats] = useState<any>(null)
  const [cacheStats, setCacheStats] = useState<any>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [batchMode, setBatchMode] = useState(false)
  const [batchQueries, setBatchQueries] = useState<string[]>([''])
  const [batchResults, setBatchResults] = useState<any>(null)
  const [showPerformance, setShowPerformance] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'txt' | 'pdf'>('csv')
  const [exportIncludeMetadata, setExportIncludeMetadata] = useState(true)
  const { toast } = useToast()

  // Search options with smart defaults
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    fuzzyThreshold: 0.3,
    includeHandwriting: true,
    minConfidence: 30,
    contextLength: 100,
    sortBy: 'relevance',
    maxResults: 50,
    enablePhoneticMatching: false,
    enableTypoCorrection: true
  })

  // Real-time search with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim().length >= 2) {
        performSearch()
      } else {
        setResults([])
        setSuggestions([])
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query, searchOptions])

  // Load search suggestions
  useEffect(() => {
    if (query.trim().length >= 2) {
      loadSuggestions()
    }
  }, [query])

  const performSearch = useCallback(async () => {
    if (!query.trim()) return

    setIsSearching(true)
    const searchStartTime = Date.now()
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          options: searchOptions
        })
      })

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      setResults(data.results || [])
      setSearchStats(data.statistics || data.stats)
      setCacheStats(data.cacheStats)

      // Log search for analytics
      try {
        await fetch('/api/search/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'log-search',
            query: query.trim(),
            resultsCount: data.results?.length || 0,
            searchTime: Date.now() - searchStartTime,
            cached: data.cached || false,
            avgConfidence: data.results?.reduce((sum: number, r: any) => sum + (r.confidence || 0), 0) / (data.results?.length || 1),
            hasHandwriting: data.results?.some((r: any) => r.isHandwritten) || false,
            documentCount: data.documentsSearched || 0
          })
        })
      } catch (analyticsError) {
        console.warn('Failed to log search analytics:', analyticsError)
      }

    } catch (error) {
      console.error('Search error:', error)
      toast({
        title: "Search Error",
        description: "Failed to perform search. Please try again."
      })
    } finally {
      setIsSearching(false)
    }
  }, [query, searchOptions, toast])

  const loadSuggestions = useCallback(async () => {
    try {
      const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.suggestions || [])
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error)
    }
  }, [query])

  const handleExport = useCallback(async () => {
    if (results.length === 0) {
      toast({
        title: "No Results",
        description: "No search results to export."
      })
      return
    }

    setIsExporting(true)
    try {
      const response = await fetch('/api/search/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          results,
          format: exportFormat,
          includeMetadata: exportIncludeMetadata,
          query,
          searchOptions,
          statistics: searchStats
        })
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `search-results-${Date.now()}.${exportFormat}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Export Successful",
        description: `Results exported as ${exportFormat.toUpperCase()} file.`
      })
      setShowExportDialog(false)
    } catch (error) {
      console.error('Export error:', error)
      toast({
        title: "Export Failed",
        description: "Failed to export results. Please try again."
      })
    } finally {
      setIsExporting(false)
    }
  }, [results, exportFormat, exportIncludeMetadata, query, searchOptions, searchStats, toast])

  const handleBatchSearch = useCallback(async () => {
    const validQueries = batchQueries.filter(q => q.trim().length > 0)
    if (validQueries.length === 0) {
      toast({
        title: "No Queries",
        description: "Please enter at least one search query."
      })
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch('/api/search/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queries: validQueries,
          options: searchOptions
        })
      })

      if (!response.ok) {
        throw new Error('Batch search failed')
      }

      const data = await response.json()
      setBatchResults(data)
      
      // Aggregate all results for display
      const allResults = data.results.flatMap((r: any) => r.results || [])
      setResults(allResults)
      setSearchStats(data.statistics)

      toast({
        title: "Batch Search Complete",
        description: `Processed ${validQueries.length} queries, found ${allResults.length} total results.`
      })
    } catch (error) {
      console.error('Batch search error:', error)
      toast({
        title: "Batch Search Failed",
        description: "Failed to perform batch search. Please try again."
      })
    } finally {
      setIsSearching(false)
    }
  }, [batchQueries, searchOptions, toast])

  const addBatchQuery = () => {
    setBatchQueries(prev => [...prev, ''])
  }

  const removeBatchQuery = (index: number) => {
    setBatchQueries(prev => prev.filter((_, i) => i !== index))
  }

  const updateBatchQuery = (index: number, value: string) => {
    setBatchQueries(prev => prev.map((q, i) => i === index ? value : q))
  }

  const handleOptionChange = useCallback((key: keyof SearchOptions, value: any) => {
    setSearchOptions(prev => ({
      ...prev,
      [key]: value
    }))
  }, [])

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 85) return "text-green-600"
    if (confidence >= 70) return "text-yellow-600"
    if (confidence >= 50) return "text-orange-600"
    return "text-red-600"
  }

  const getConfidenceBadgeVariant = (confidence: number): "default" | "destructive" | "outline" | "secondary" => {
    if (confidence >= 85) return "default"
    if (confidence >= 70) return "secondary"
    if (confidence >= 50) return "outline"
    return "destructive"
  }

  const highlightMatches = (text: string, searchQuery: string) => {
    if (!searchQuery.trim()) return text
    
    try {
      const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
      return text.replace(regex, '<mark class="bg-yellow-200 font-semibold">$1</mark>')
    } catch {
      return text
    }
  }

  const formatContext = (result: SearchResult) => {
    if (!result.context) return result.text
    
    const highlighted = highlightMatches(result.context, query)
    return (
      <div 
        className="text-sm text-gray-700 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    )
  }

  const resultGroups = useMemo(() => {
    const groups = {
      highConfidence: results.filter(r => r.confidence >= 85),
      mediumConfidence: results.filter(r => r.confidence >= 50 && r.confidence < 85),
      lowConfidence: results.filter(r => r.confidence < 50),
      handwritten: results.filter(r => r.isHandwritten)
    }
    return groups
  }, [results])

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-600" />
            Smart OCR Search
            {searchStats && (
              <Badge variant="outline" className="ml-2">
                {searchStats.totalDocuments} docs
              </Badge>
            )}
            {cacheStats && (
              <Badge variant="outline" className="ml-2 text-green-600">
                <Database className="h-3 w-3 mr-1" />
                Cache: {(cacheStats.hitRate * 100).toFixed(0)}%
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {results.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExportDialog(true)}
                disabled={isExporting}
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPerformance(!showPerformance)}
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBatchMode(!batchMode)}
              className={batchMode ? "bg-blue-100" : ""}
            >
              <Layers className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search OCR results... (e.g., 'patient name', '$amount', medication)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-4"
            disabled={batchMode}
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          )}
        </div>

        {/* Batch Search Interface */}
        {batchMode && (
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Batch Search Mode
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {batchQueries.map((query, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder={`Search query ${index + 1}...`}
                    value={query}
                    onChange={(e) => updateBatchQuery(index, e.target.value)}
                    className="flex-1"
                  />
                  {batchQueries.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeBatchQuery(index)}
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addBatchQuery}
                >
                  + Add Query
                </Button>
                <Button
                  onClick={handleBatchSearch}
                  disabled={isSearching || batchQueries.every(q => !q.trim())}
                  className="flex-1"
                >
                  {isSearching ? 'Searching...' : 'Search All'}
                </Button>
              </div>
              {batchResults && (
                <Alert>
                  <AlertDescription>
                    <div className="text-sm">
                      <div>Batch completed: {batchResults.results.length} queries processed</div>
                      <div>Total results: {batchResults.results.flatMap((r: any) => r.results || []).length}</div>
                      <div>Average time: {(batchResults.statistics.totalTime / batchResults.results.length).toFixed(0)}ms per query</div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Performance Monitoring Dashboard */}
        {showPerformance && (cacheStats || searchStats) && (
          <Card className="bg-gray-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cacheStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {(cacheStats.hitRate * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-600">Cache Hit Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {cacheStats.size || 0}
                    </div>
                    <div className="text-xs text-gray-600">Cached Items</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {((cacheStats.memoryUsage || 0) / 1024 / 1024).toFixed(1)}MB
                    </div>
                    <div className="text-xs text-gray-600">Memory Usage</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {(cacheStats.utilizationRate * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-600">Utilization</div>
                  </div>
                </div>
              )}
              
              {searchStats && (
                <div className="pt-2 border-t">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="font-medium">Search Time</div>
                      <div className="text-gray-600">{searchStats.searchTime || 0}ms</div>
                    </div>
                    <div>
                      <div className="font-medium">Documents</div>
                      <div className="text-gray-600">{searchStats.documentsSearched || 0}</div>
                    </div>
                    <div>
                      <div className="font-medium">Avg Confidence</div>
                      <div className="text-gray-600">
                        {results.length > 0 
                          ? (results.reduce((sum, r) => sum + r.confidence, 0) / results.length).toFixed(1)
                          : 0}%
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await fetch('/api/search/cache', { method: 'POST' })
                      toast({ title: "Cache cleared successfully" })
                    } catch (error) {
                      toast({ title: "Failed to clear cache" })
                    }
                  }}
                >
                  Clear Cache
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await fetch('/api/search/cache?action=warm', { method: 'POST' })
                      toast({ title: "Cache warming initiated" })
                    } catch (error) {
                      toast({ title: "Failed to warm cache" })
                    }
                  }}
                >
                  Warm Cache
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Export Dialog */}
        {showExportDialog && (
          <Card className="bg-green-50 border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export Search Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(['csv', 'json', 'txt', 'pdf'] as const).map(format => (
                  <Button
                    key={format}
                    variant={exportFormat === format ? "default" : "outline"}
                    size="sm"
                    onClick={() => setExportFormat(format)}
                  >
                    {format.toUpperCase()}
                  </Button>
                ))}
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="include-metadata" className="text-sm">
                  Include metadata & search options
                </Label>
                <Switch
                  id="include-metadata"
                  checked={exportIncludeMetadata}
                  onCheckedChange={setExportIncludeMetadata}
                />
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex-1"
                >
                  {isExporting ? 'Exporting...' : `Export as ${exportFormat.toUpperCase()}`}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowExportDialog(false)}
                >
                  Cancel
                </Button>
              </div>
              
              <div className="text-xs text-gray-600">
                Exporting {results.length} search results for query: "{query || 'batch search'}"
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search Suggestions */}
        {suggestions.length > 0 && query.length >= 2 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-500">Suggestions:</span>
            {suggestions.slice(0, 5).map((suggestion, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => setQuery(suggestion)}
                className="h-7 text-xs"
              >
                {suggestion}
              </Button>
            ))}
          </div>
        )}

        {/* Advanced Options */}
        {showAdvanced && (
          <Card className="bg-gray-50">
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Fuzzy Search Threshold */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Fuzzy Threshold: {searchOptions.fuzzyThreshold.toFixed(1)}
                  </Label>
                  <Slider
                    value={[searchOptions.fuzzyThreshold]}
                    onValueChange={([value]) => handleOptionChange('fuzzyThreshold', value)}
                    min={0}
                    max={1}
                    step={0.1}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500">
                    Lower = exact matches, Higher = more fuzzy matches
                  </p>
                </div>

                {/* Minimum Confidence */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Min Confidence: {searchOptions.minConfidence}%
                  </Label>
                  <Slider
                    value={[searchOptions.minConfidence]}
                    onValueChange={([value]) => handleOptionChange('minConfidence', value)}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>

                {/* Sort By */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <SortAsc className="h-4 w-4" />
                    Sort Results
                  </Label>
                  <Select
                    value={searchOptions.sortBy}
                    onValueChange={(value: any) => handleOptionChange('sortBy', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevance">Relevance</SelectItem>
                      <SelectItem value="confidence">Confidence</SelectItem>
                      <SelectItem value="page">Page Number</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Max Results */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    Max Results: {searchOptions.maxResults}
                  </Label>
                  <Slider
                    value={[searchOptions.maxResults]}
                    onValueChange={([value]) => handleOptionChange('maxResults', value)}
                    min={10}
                    max={200}
                    step={10}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Toggle Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="include-handwriting" className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Include Handwriting
                  </Label>
                  <Switch
                    id="include-handwriting"
                    checked={searchOptions.includeHandwriting}
                    onCheckedChange={(checked) => handleOptionChange('includeHandwriting', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="typo-correction" className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Typo Correction
                  </Label>
                  <Switch
                    id="typo-correction"
                    checked={searchOptions.enableTypoCorrection}
                    onCheckedChange={(checked) => handleOptionChange('enableTypoCorrection', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search Results */}
        {results.length > 0 && (
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="all">
                All Results ({results.length})
              </TabsTrigger>
              {resultGroups.highConfidence.length > 0 && (
                <TabsTrigger value="high">
                  High Confidence ({resultGroups.highConfidence.length})
                </TabsTrigger>
              )}
              {resultGroups.handwritten.length > 0 && (
                <TabsTrigger value="handwritten">
                  Handwritten ({resultGroups.handwritten.length})
                </TabsTrigger>
              )}
              {resultGroups.lowConfidence.length > 0 && (
                <TabsTrigger value="low">
                  Low Confidence ({resultGroups.lowConfidence.length})
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="all" className="space-y-3">
              {results.map((result, index) => (
                <SearchResultCard
                  key={index}
                  result={result}
                  query={query}
                  onSelect={onResultSelect}
                  formatContext={formatContext}
                  getConfidenceColor={getConfidenceColor}
                  getConfidenceBadgeVariant={getConfidenceBadgeVariant}
                />
              ))}
            </TabsContent>

            <TabsContent value="high" className="space-y-3">
              {resultGroups.highConfidence.map((result, index) => (
                <SearchResultCard
                  key={index}
                  result={result}
                  query={query}
                  onSelect={onResultSelect}
                  formatContext={formatContext}
                  getConfidenceColor={getConfidenceColor}
                  getConfidenceBadgeVariant={getConfidenceBadgeVariant}
                />
              ))}
            </TabsContent>

            <TabsContent value="handwritten" className="space-y-3">
              {resultGroups.handwritten.map((result, index) => (
                <SearchResultCard
                  key={index}
                  result={result}
                  query={query}
                  onSelect={onResultSelect}
                  formatContext={formatContext}
                  getConfidenceColor={getConfidenceColor}
                  getConfidenceBadgeVariant={getConfidenceBadgeVariant}
                />
              ))}
            </TabsContent>

            <TabsContent value="low" className="space-y-3">
              {resultGroups.lowConfidence.map((result, index) => (
                <SearchResultCard
                  key={index}
                  result={result}
                  query={query}
                  onSelect={onResultSelect}
                  formatContext={formatContext}
                  getConfidenceColor={getConfidenceColor}
                  getConfidenceBadgeVariant={getConfidenceBadgeVariant}
                />
              ))}
            </TabsContent>
          </Tabs>
        )}

        {/* Search Statistics */}
        {searchStats && results.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="text-sm space-y-1">
                <div>Search completed in {searchStats.searchTime || 'unknown'}ms</div>
                <div>Found {results.length} matches across {searchStats.documentsSearched || 0} documents</div>
                {searchStats.handwritingMatches > 0 && (
                  <div className="text-orange-600">
                    {searchStats.handwritingMatches} handwritten matches (review recommended)
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* No Results */}
        {query.trim() && !isSearching && results.length === 0 && (
          <Alert>
            <Search className="h-4 w-4" />
            <AlertDescription>
              No results found for "{query}". Try:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Using different keywords</li>
                <li>Reducing the minimum confidence threshold</li>
                <li>Increasing the fuzzy search threshold</li>
                <li>Including handwritten text results</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

interface SearchResultCardProps {
  result: SearchResult
  query: string
  onSelect?: (result: SearchResult) => void
  formatContext: (result: SearchResult) => React.ReactNode
  getConfidenceColor: (confidence: number) => string
  getConfidenceBadgeVariant: (confidence: number) => "default" | "destructive" | "outline" | "secondary"
}

function SearchResultCard({ 
  result, 
  query, 
  onSelect, 
  formatContext, 
  getConfidenceColor, 
  getConfidenceBadgeVariant 
}: SearchResultCardProps) {
  return (
    <Card 
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onSelect?.(result)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium">
              {result.documentName || 'Document'} - Page {result.page}
            </span>
            {result.isHandwritten && (
              <Badge variant="outline" className="text-xs">
                <BookOpen className="h-3 w-3 mr-1" />
                Handwritten
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getConfidenceBadgeVariant(result.confidence)}>
              {result.confidence.toFixed(0)}%
            </Badge>
            {result.qualityScore && (
              <div className="text-xs text-gray-500">
                Quality: {(result.qualityScore * 100).toFixed(0)}%
              </div>
            )}
          </div>
        </div>

        <div className="mb-2">
          {formatContext(result)}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Match Score: {(result.matchScore * 100).toFixed(0)}%</span>
            {result.boundingBox && (
              <span>• Position: ({result.boundingBox.x0}, {result.boundingBox.y0})</span>
            )}
          </div>
          <Button variant="outline" size="sm">
            <Eye className="h-3 w-3 mr-1" />
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default SmartSearch
