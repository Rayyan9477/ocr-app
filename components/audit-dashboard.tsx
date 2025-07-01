"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  Download, 
  Search, 
  Calendar, 
  User, 
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Filter
} from "lucide-react";

interface AuditEvent {
  id: string;
  timestamp: Date;
  userId: string;
  userRole: string;
  action: string;
  resource: string;
  outcome: 'SUCCESS' | 'FAILURE';
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
}

interface AuditStats {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  uniqueUsers: number;
  recentActivity: number;
  topActions: Array<{ action: string; count: number }>;
}

interface AuditDashboardProps {
  className?: string;
}

export function AuditDashboard({ className }: AuditDashboardProps) {
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    userId: '',
    action: '',
    outcome: '' as '' | 'SUCCESS' | 'FAILURE'
  });

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });

      const response = await fetch(`/api/audit?${queryParams.toString()}`);
      const result = await response.json();

      if (response.ok && result.success) {
        setAuditLogs(result.auditLogs);
        setStats(result.stats);
      } else {
        setError(result.error || 'Failed to fetch audit logs');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const exportAuditLogs = async (format: 'json' | 'csv') => {
    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ format, filters }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Create and download file
        const blob = new Blob([result.data], {
          type: format === 'json' ? 'application/json' : 'text/csv'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        setError(result.error || 'Export failed');
      }
    } catch (error) {
      setError('Export failed. Please try again.');
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleString();
  };

  const getOutcomeIcon = (outcome: string) => {
    return outcome === 'SUCCESS' ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-red-600" />
    );
  };

  const getOutcomeBadge = (outcome: string) => {
    return (
      <Badge variant={outcome === 'SUCCESS' ? 'default' : 'destructive'}>
        {outcome}
      </Badge>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield className="h-6 w-6 text-blue-600" />
              <div>
                <CardTitle>HIPAA Audit Dashboard</CardTitle>
                <CardDescription>
                  Comprehensive audit logging and compliance monitoring
                </CardDescription>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={() => exportAuditLogs('csv')}
                variant="outline"
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                onClick={() => exportAuditLogs('json')}
                variant="outline"
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="logs">Audit Logs</TabsTrigger>
              <TabsTrigger value="filters">Filters</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2">
                        <Activity className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium">Total Events</p>
                          <p className="text-2xl font-bold">{stats.totalEvents}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="text-sm font-medium">Success Rate</p>
                          <p className="text-2xl font-bold">
                            {stats.totalEvents > 0 
                              ? Math.round((stats.successfulEvents / stats.totalEvents) * 100)
                              : 0}%
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2">
                        <User className="h-5 w-5 text-purple-600" />
                        <div>
                          <p className="text-sm font-medium">Active Users</p>
                          <p className="text-2xl font-bold">{stats.uniqueUsers}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {stats?.topActions && stats.topActions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Top Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {stats.topActions.map((action, index) => (
                        <div key={index} className="flex justify-between items-center">
                          <span className="text-sm font-medium">{action.action}</span>
                          <Badge variant="outline">{action.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="logs" className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Recent Activity</h3>
                <Button onClick={fetchAuditLogs} disabled={isLoading} size="sm">
                  {isLoading ? "Loading..." : "Refresh"}
                </Button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {auditLogs.map((log) => (
                  <Card key={log.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        {getOutcomeIcon(log.outcome)}
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{log.action}</span>
                            {getOutcomeBadge(log.outcome)}
                          </div>
                          <p className="text-sm text-gray-600">
                            {log.resource} by {log.userId} ({log.userRole})
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatTimestamp(log.timestamp)} • {log.ipAddress}
                          </p>
                          {log.details && Object.keys(log.details).length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs text-blue-600 cursor-pointer">
                                View Details
                              </summary>
                              <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {auditLogs.length === 0 && !isLoading && (
                <div className="text-center py-8 text-gray-500">
                  No audit logs found for the current filters.
                </div>
              )}
            </TabsContent>

            <TabsContent value="filters" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      startDate: e.target.value
                    }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      endDate: e.target.value
                    }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="userId">User ID</Label>
                  <Input
                    id="userId"
                    type="text"
                    value={filters.userId}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      userId: e.target.value
                    }))}
                    placeholder="Filter by user ID"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="action">Action</Label>
                  <Input
                    id="action"
                    type="text"
                    value={filters.action}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      action: e.target.value
                    }))}
                    placeholder="e.g., USER_LOGIN, FILE_UPLOAD"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="outcome">Outcome</Label>
                  <select
                    id="outcome"
                    value={filters.outcome}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      outcome: e.target.value as '' | 'SUCCESS' | 'FAILURE'
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All</option>
                    <option value="SUCCESS">Success</option>
                    <option value="FAILURE">Failure</option>
                  </select>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Button onClick={fetchAuditLogs} disabled={isLoading}>
                  <Filter className="h-4 w-4 mr-2" />
                  Apply Filters
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilters({
                      startDate: '',
                      endDate: '',
                      userId: '',
                      action: '',
                      outcome: ''
                    });
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
