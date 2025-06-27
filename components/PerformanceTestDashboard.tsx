"use client";

import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";

interface PerformanceData {
  testId: string;
  documentType: string;
  featureSet: string;
  processingTime: number;
  confidence: number;
  success: boolean;
  memoryUsage: number;
  wordCount: number;
  timestamp: string;
}

interface TestStats {
  averageTime: number;
  averageConfidence: number;
  successRate: number;
  averageMemoryUsage: number;
  sampleCount: number;
}

interface PerformanceReport {
  overallStats: TestStats;
  byDocumentType: Record<string, TestStats>;
  byFeatureSet: Record<string, TestStats>;
  byDocumentAndFeature: Record<string, TestStats>;
  recommendations: string[];
  timestamp: string;
}

const PerformanceTestDashboard: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [recentResults, setRecentResults] = useState<PerformanceData[]>([]);

  // Function to run a new performance test
  const runPerformanceTest = async () => {
    setTestRunning(true);
    setProgress(0);

    try {
      // In a real implementation, this would call the test API
      // and track progress
      for (let i = 0; i <= 100; i += 5) {
        setProgress(i);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Fetch the updated report
      await fetchPerformanceReport();

    } catch (error) {
      console.error('Performance test error:', error);
    } finally {
      setTestRunning(false);
      setProgress(100);
    }
  };

  // Function to fetch the latest performance report
  const fetchPerformanceReport = async () => {
    setIsLoading(true);

    try {
      // In a real implementation, this would fetch from an API
      // Mock data for demonstration
      const mockReport: PerformanceReport = {
        overallStats: {
          averageTime: 1250,
          averageConfidence: 87.5,
          successRate: 95,
          averageMemoryUsage: 125,
          sampleCount: 20
        },
        byDocumentType: {
          'simple.pdf': {
            averageTime: 950,
            averageConfidence: 92.3,
            successRate: 100,
            averageMemoryUsage: 110,
            sampleCount: 5
          },
          'complex.pdf': {
            averageTime: 1450,
            averageConfidence: 85.1,
            successRate: 90,
            averageMemoryUsage: 140,
            sampleCount: 5
          },
          'handwritten.pdf': {
            averageTime: 1550,
            averageConfidence: 79.8,
            successRate: 90,
            averageMemoryUsage: 145,
            sampleCount: 5
          },
          'highlighted.pdf': {
            averageTime: 1350,
            averageConfidence: 82.7,
            successRate: 100,
            averageMemoryUsage: 130,
            sampleCount: 5
          }
        },
        byFeatureSet: {
          'base': {
            averageTime: 850,
            averageConfidence: 78.5,
            successRate: 100,
            averageMemoryUsage: 90,
            sampleCount: 5
          },
          'enhanced': {
            averageTime: 1150,
            averageConfidence: 88.2,
            successRate: 100,
            averageMemoryUsage: 115,
            sampleCount: 5
          },
          'vlm': {
            averageTime: 1450,
            averageConfidence: 92.5,
            successRate: 90,
            averageMemoryUsage: 155,
            sampleCount: 5
          },
          'tensor': {
            averageTime: 1550,
            averageConfidence: 90.8,
            successRate: 90,
            averageMemoryUsage: 170,
            sampleCount: 5
          }
        },
        byDocumentAndFeature: {
          'simple.pdf-base': {
            averageTime: 750,
            averageConfidence: 85.2,
            successRate: 100,
            averageMemoryUsage: 85,
            sampleCount: 5
          },
          'complex.pdf-enhanced': {
            averageTime: 1250,
            averageConfidence: 87.5,
            successRate: 100,
            averageMemoryUsage: 125,
            sampleCount: 5
          }
          // Additional combinations would be here
        },
        recommendations: [
          'Best overall performance: vlm feature set (92.50 confidence)',
          'Best for simple.pdf documents: base feature set (85.20 confidence)',
          'Best for complex.pdf documents: enhanced feature set (87.50 confidence)',
          'Performance concern: tensor feature set is 1.8x slower than baseline but only 15.7% more accurate'
        ],
        timestamp: new Date().toISOString()
      };

      setReport(mockReport);

      // Generate mock recent results
      const mockResults: PerformanceData[] = [];
      for (let i = 0; i < 10; i++) {
        mockResults.push({
          testId: `test-${i}`,
          documentType: ['simple.pdf', 'complex.pdf', 'handwritten.pdf', 'highlighted.pdf'][i % 4],
          featureSet: ['base', 'enhanced', 'vlm', 'tensor'][i % 4],
          processingTime: 800 + Math.random() * 1000,
          confidence: 75 + Math.random() * 20,
          success: Math.random() > 0.1,
          memoryUsage: 80 + Math.random() * 100,
          wordCount: 100 + Math.floor(Math.random() * 500),
          timestamp: new Date(Date.now() - i * 60000).toISOString()
        });
      }

      setRecentResults(mockResults);

    } catch (error) {
      console.error('Failed to fetch performance report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch the report on initial load
  useEffect(() => {
    fetchPerformanceReport();
  }, []);

  // Format data for feature set chart
  const prepareFeatureSetData = () => {
    if (!report) return [];

    return Object.entries(report.byFeatureSet).map(([name, stats]) => ({
      name,
      time: stats.averageTime,
      confidence: stats.averageConfidence,
      successRate: stats.successRate,
      memory: stats.averageMemoryUsage
    }));
  };

  // Format data for document type chart
  const prepareDocumentTypeData = () => {
    if (!report) return [];

    return Object.entries(report.byDocumentType).map(([name, stats]) => ({
      name,
      time: stats.averageTime,
      confidence: stats.averageConfidence,
      successRate: stats.successRate,
      memory: stats.averageMemoryUsage
    }));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">OCR Performance Dashboard</h1>
        <div className="flex space-x-2">
          <Button
            onClick={runPerformanceTest}
            disabled={testRunning}
          >
            {testRunning ? 'Running Tests...' : 'Run Performance Test'}
          </Button>
          <Button
            variant="outline"
            onClick={() => fetchPerformanceReport()}
            disabled={isLoading || testRunning}
          >
            Refresh Data
          </Button>
        </div>
      </div>

      {testRunning && (
        <Card className="my-4">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Running Performance Test</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          </CardContent>
        </Card>
      )}

      {report && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Processing Time</CardTitle>
              <CardDescription>Average processing time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{report.overallStats.averageTime.toFixed(0)} ms</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Confidence</CardTitle>
              <CardDescription>Average confidence score</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{report.overallStats.averageConfidence.toFixed(1)}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Success Rate</CardTitle>
              <CardDescription>Percentage of successful processes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{report.overallStats.successRate.toFixed(0)}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Memory Usage</CardTitle>
              <CardDescription>Average memory consumption</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{report.overallStats.averageMemoryUsage.toFixed(0)} KB</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="features">
        <TabsList>
          <TabsTrigger value="features">By Feature Set</TabsTrigger>
          <TabsTrigger value="documents">By Document Type</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="recent">Recent Tests</TabsTrigger>
        </TabsList>

        <TabsContent value="features" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance by Feature Set</CardTitle>
              <CardDescription>
                Comparison of different OCR processing features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={prepareFeatureSetData()} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                    <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="time" name="Processing Time (ms)" fill="#8884d8" />
                    <Bar yAxisId="right" dataKey="confidence" name="Confidence (%)" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance by Document Type</CardTitle>
              <CardDescription>
                Comparison of OCR performance across document types
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={prepareDocumentTypeData()} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                    <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="time" name="Processing Time (ms)" fill="#8884d8" />
                    <Bar yAxisId="right" dataKey="confidence" name="Confidence (%)" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Recommendations</CardTitle>
              <CardDescription>
                Suggestions for optimizing OCR performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {report && report.recommendations.length > 0 ? (
                <ul className="list-disc pl-6 space-y-2">
                  {report.recommendations.map((rec, index) => (
                    <li key={index} className="text-sm">{rec}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No recommendations available. Run more tests to generate insights.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Test Results</CardTitle>
              <CardDescription>
                Latest individual test runs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Document</th>
                      <th className="text-left py-3 px-4">Feature Set</th>
                      <th className="text-right py-3 px-4">Time (ms)</th>
                      <th className="text-right py-3 px-4">Confidence</th>
                      <th className="text-right py-3 px-4">Status</th>
                      <th className="text-right py-3 px-4">Memory (KB)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentResults.map((result, index) => (
                      <tr key={result.testId} className={index % 2 === 0 ? 'bg-muted/50' : ''}>
                        <td className="py-2 px-4">{result.documentType}</td>
                        <td className="py-2 px-4">{result.featureSet}</td>
                        <td className="py-2 px-4 text-right">{result.processingTime.toFixed(0)}</td>
                        <td className="py-2 px-4 text-right">{result.confidence.toFixed(1)}%</td>
                        <td className="py-2 px-4 text-right">
                          <span className={`inline-block px-2 py-1 rounded text-xs ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {result.success ? 'Success' : 'Failed'}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-right">{result.memoryUsage.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PerformanceTestDashboard;
