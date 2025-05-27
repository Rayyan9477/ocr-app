"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts"
import { 
  Download, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  FileText,
  Calendar,
  BarChart3
} from "lucide-react"

interface ConfidenceReport {
  success: boolean
  summary: {
    reportGenerated: string
    dateRange: {
      from: string | null
      to: string | null
    }
    overview: {
      totalDocuments: number
      totalPages: number
      averageConfidence: number
      documentsWithIssues: number
      issueRate: number
    }
    qualityBreakdown: {
      excellent: number
      good: number
      warning: number
      error: number
    }
    pageAnalysis: {
      totalPages: number
      goodPages: number
      warningPages: number
      errorPages: number
      errorRate: number
    }
    trends: {
      last7Days: {
        documents: number
        averageConfidence: number
        issueRate: number
      }
      last30Days: {
        documents: number
        averageConfidence: number
        issueRate: number
      }
    }
  }
  documents?: Array<{
    documentId: string
    inputFile: string
    outputFile: string
    averageConfidence: number
    hasLowConfidencePages: boolean
    warningPages: number[]
    errorPages: number[]
    pageCount: number
    processedAt: string
  }>
}

export function ConfidenceReportDashboard() {
  const [report, setReport] = useState<ConfidenceReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reportType, setReportType] = useState<'summary' | 'detailed'>('summary')

  const fetchReport = async (type: 'summary' | 'detailed' = 'summary') => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/low-confidence-report?format=${type}`)
      const data = await response.json()
      
      if (data.success) {
        setReport(data)
        setReportType(type)
      } else {
        setError(data.error || 'Failed to fetch report')
      }
    } catch (err) {
      setError('Network error while fetching report')
      console.error('Report fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const downloadCSV = async () => {
    try {
      const response = await fetch('/api/low-confidence-report?format=csv')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `ocr-confidence-report-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('CSV download error:', err)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Loading confidence report...
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8 text-red-600">
          <AlertTriangle className="h-6 w-6 mr-2" />
          {error}
        </CardContent>
      </Card>
    )
  }

  if (!report) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <FileText className="h-6 w-6 mr-2" />
          No confidence data available
        </CardContent>
      </Card>
    )
  }

  const { summary } = report

  // Prepare chart data
  const qualityData = [
    { name: 'Excellent (95%+)', value: summary.qualityBreakdown.excellent, color: '#22c55e' },
    { name: 'Good (85-95%)', value: summary.qualityBreakdown.good, color: '#3b82f6' },
    { name: 'Warning (70-85%)', value: summary.qualityBreakdown.warning, color: '#f59e0b' },
    { name: 'Error (<70%)', value: summary.qualityBreakdown.error, color: '#ef4444' },
  ]

  const trendData = [
    {
      period: 'Last 7 Days',
      confidence: summary.trends.last7Days.averageConfidence,
      documents: summary.trends.last7Days.documents,
      issueRate: summary.trends.last7Days.issueRate
    },
    {
      period: 'Last 30 Days', 
      confidence: summary.trends.last30Days.averageConfidence,
      documents: summary.trends.last30Days.documents,
      issueRate: summary.trends.last30Days.issueRate
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">OCR Confidence Report</h2>
          <p className="text-muted-foreground">
            Generated on {new Date(summary.reportGenerated).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fetchReport(reportType)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={downloadCSV}>
            <Download className="h-4 w-4 mr-2" />
            Download CSV
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.overview.totalDocuments}</div>
            <p className="text-xs text-muted-foreground">
              {summary.overview.totalPages} pages processed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Confidence</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.overview.averageConfidence}%</div>
            <Progress value={summary.overview.averageConfidence} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents with Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.overview.documentsWithIssues}</div>
            <p className="text-xs text-muted-foreground">
              {summary.overview.issueRate}% of all documents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Page Error Rate</CardTitle>
            {summary.pageAnalysis.errorRate > 5 ? (
              <TrendingUp className="h-4 w-4 text-red-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-green-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.pageAnalysis.errorRate}%</div>
            <p className="text-xs text-muted-foreground">
              {summary.pageAnalysis.errorPages} error pages
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="quality">Quality Breakdown</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          {reportType === 'detailed' && <TabsTrigger value="documents">Document Details</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quality Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Quality Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={qualityData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {qualityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Page Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Page Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Good Pages</span>
                    <Badge variant="default">{summary.pageAnalysis.goodPages}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Warning Pages</span>
                    <Badge variant="secondary">{summary.pageAnalysis.warningPages}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Error Pages</span>
                    <Badge variant="destructive">{summary.pageAnalysis.errorPages}</Badge>
                  </div>
                </div>
                
                <div className="pt-4">
                  <div className="text-sm mb-2">Page Quality Distribution</div>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
                      <span className="text-sm">Good: {((summary.pageAnalysis.goodPages / summary.pageAnalysis.totalPages) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-yellow-500 rounded mr-2"></div>
                      <span className="text-sm">Warning: {((summary.pageAnalysis.warningPages / summary.pageAnalysis.totalPages) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-red-500 rounded mr-2"></div>
                      <span className="text-sm">Error: {summary.pageAnalysis.errorRate}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="quality" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Document Quality Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={qualityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Confidence Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="confidence" stroke="#8884d8" name="Avg Confidence %" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Issue Rate Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="issueRate" stroke="#ef4444" name="Issue Rate %" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {reportType === 'detailed' && report.documents && (
          <TabsContent value="documents" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Document Details</h3>
              <Button onClick={() => fetchReport('detailed')} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Load Detailed View
              </Button>
            </div>
            
            <div className="space-y-3">
              {report.documents.map((doc) => (
                <Card key={doc.documentId}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="font-medium">{doc.inputFile}</h4>
                        <p className="text-sm text-muted-foreground">
                          Processed: {new Date(doc.processedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge 
                          variant={doc.averageConfidence >= 85 ? "default" : doc.averageConfidence >= 70 ? "secondary" : "destructive"}
                        >
                          {doc.averageConfidence}% confidence
                        </Badge>
                        <div className="text-sm text-muted-foreground">
                          {doc.pageCount} pages
                        </div>
                      </div>
                    </div>
                    
                    {doc.hasLowConfidencePages && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex gap-4 text-sm">
                          {doc.errorPages.length > 0 && (
                            <span className="text-red-600">
                              Error pages: {doc.errorPages.join(', ')}
                            </span>
                          )}
                          {doc.warningPages.length > 0 && (
                            <span className="text-orange-600">
                              Warning pages: {doc.warningPages.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
