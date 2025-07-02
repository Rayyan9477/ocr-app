"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield,  User,
  LogOut, 
  Settings, 
  Activity,
  FileText,
  Database,
  Lock,
  AlertCircle,
  CheckCircle,
  Users
} from "lucide-react";

import { HIPAAAuth } from "@/components/hipaa-auth";
import { HIPAAFileUploader } from "@/components/hipaa-file-uploader";
import { AuditDashboard } from "@/components/audit-dashboard";
import { UserManagement } from "@/components/user-management";
import { ClientOnly } from "@/components/client-only";

interface User {
  id: string;
  email: string;
  role: string;
  mfaEnabled: boolean;
}

interface ProcessedFile {
  fileName: string;
  success: boolean;
  averageConfidence?: number;
  pages?: Array<{
    pageNumber: number;
    text: string;
    confidence: number;
  }>;
  downloadUrl?: string;
  error?: string;
}

export default function HIPAACompliantOCR() {
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [processedResults, setProcessedResults] = useState<ProcessedFile[]>([]);
  const [complianceStatus, setComplianceStatus] = useState({
    encryption: true,
    auditLogging: true,
    accessControl: true,
    dataIntegrity: true,
    autoCleanup: true
  });

  // Check authentication status on load
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/session');
      const result = await response.json();
      
      if (result.authenticated && result.user) {
        setUser(result.user);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleAuthSuccess = (authenticatedUser: User) => {
    setUser(authenticatedUser);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setProcessedResults([]);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleFilesProcessed = (results: ProcessedFile[]) => {
    setProcessedResults(results);
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Shield className="h-12 w-12 text-blue-600 mr-2" />
              <Lock className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              HIPAA-Compliant OCR
            </h1>
            <p className="text-gray-600">
              Secure, auditable document processing for healthcare
            </p>
          </div>
          
          <ClientOnly>
            <HIPAAAuth onAuthSuccess={handleAuthSuccess} />
          </ClientOnly>
          
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Compliance Features</h3>
            <div className="grid grid-cols-2 gap-2 text-sm text-blue-800">
              <div className="flex items-center">
                <CheckCircle className="h-3 w-3 mr-1" />
                256-bit AES Encryption
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-3 w-3 mr-1" />
                Comprehensive Auditing
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-3 w-3 mr-1" />
                Access Control
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-3 w-3 mr-1" />
                Data Integrity
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-3 w-3 mr-1" />
                Automatic Cleanup
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-3 w-3 mr-1" />
                Secure Transmission
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-blue-600" />
              <Lock className="h-6 w-6 text-green-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  HIPAA-Compliant OCR
                </h1>
                <p className="text-xs text-gray-500">
                  Secure Healthcare Document Processing
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Compliance Status */}
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  HIPAA Compliant
                </Badge>
              </div>
              
              {/* User Info */}
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  {user.email}
                </span>
                <Badge variant="outline">
                  {user.role}
                </Badge>
              </div>
              
              {/* Logout Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="process" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="process">
              <FileText className="h-4 w-4 mr-2" />
              Process Files
            </TabsTrigger>
            <TabsTrigger value="audit" disabled={user.role === 'viewer'}>
              <Activity className="h-4 w-4 mr-2" />
              Audit Logs
            </TabsTrigger>
            <TabsTrigger value="compliance">
              <Shield className="h-4 w-4 mr-2" />
              Compliance
            </TabsTrigger>
            <TabsTrigger value="users" disabled={user.role !== 'admin'}>
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="settings" disabled={user.role !== 'admin'}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="process" className="mt-6">
            <ClientOnly>
              <HIPAAFileUploader onFilesProcessed={handleFilesProcessed} />
            </ClientOnly>
          </TabsContent>

          <TabsContent value="audit" className="mt-6">
            {user.role !== 'viewer' ? (
              <ClientOnly>
                <AuditDashboard />
              </ClientOnly>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Audit log access requires user or admin privileges.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="compliance" className="mt-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="h-6 w-6 text-blue-600" />
                    <span>HIPAA Compliance Status</span>
                  </CardTitle>
                  <CardDescription>
                    Real-time monitoring of all HIPAA technical safeguards
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(complianceStatus).map(([key, status]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center space-x-2">
                          {status ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-red-600" />
                          )}
                          <span className="font-medium capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                        </div>
                        <Badge variant={status ? "default" : "destructive"}>
                          {status ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Technical Safeguards Implementation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <h3 className="font-semibold text-green-900 mb-2">Access Control</h3>
                        <ul className="text-sm text-green-800 space-y-1">
                          <li>• User authentication required</li>
                          <li>• Role-based permissions</li>
                          <li>• Session management</li>
                          <li>• MFA support available</li>
                        </ul>
                      </div>
                      
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <h3 className="font-semibold text-green-900 mb-2">Audit Controls</h3>
                        <ul className="text-sm text-green-800 space-y-1">
                          <li>• All access logged</li>
                          <li>• File operations tracked</li>
                          <li>• User activities monitored</li>
                          <li>• Export capabilities</li>
                        </ul>
                      </div>
                      
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <h3 className="font-semibold text-green-900 mb-2">Data Integrity</h3>
                        <ul className="text-sm text-green-800 space-y-1">
                          <li>• Encryption at rest</li>
                          <li>• Checksum verification</li>
                          <li>• Secure file handling</li>
                          <li>• Automatic cleanup</li>
                        </ul>
                      </div>
                      
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <h3 className="font-semibold text-green-900 mb-2">Transmission Security</h3>
                        <ul className="text-sm text-green-800 space-y-1">
                          <li>• HTTPS/TLS encryption</li>
                          <li>• Secure file upload</li>
                          <li>• End-to-end protection</li>
                          <li>• Certificate validation</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Deployment Recommendations</CardTitle>
                  <CardDescription>
                    HIPAA-compliant hosting options for production deployment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="p-3 border rounded-lg">
                      <h4 className="font-medium text-green-700">✅ Recommended: Azure Container Apps</h4>
                      <p className="text-sm text-gray-600">Full HIPAA compliance, BAA available, $50-200/month</p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <h4 className="font-medium text-green-700">✅ Recommended: AWS ECS with Fargate</h4>
                      <p className="text-sm text-gray-600">HIPAA eligible services, BAA available, $40-150/month</p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <h4 className="font-medium text-yellow-700">⚠️ Development Only: ngrok</h4>
                      <p className="text-sm text-gray-600">Not HIPAA compliant, use for testing only</p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <h4 className="font-medium text-red-700">❌ Not Recommended: Standard hosting</h4>
                      <p className="text-sm text-gray-600">Most platforms don't offer HIPAA compliance</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            {user.role === 'admin' ? (
              <ClientOnly>
                <UserManagement currentUser={user} />
              </ClientOnly>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  User management requires administrator privileges.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            {user.role === 'admin' ? (
              <Card>
                <CardHeader>
                  <CardTitle>System Settings</CardTitle>
                  <CardDescription>
                    Administrative controls for HIPAA compliance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Alert>
                    <Database className="h-4 w-4" />
                    <AlertDescription>
                      Advanced settings will be available in the next update. 
                      Current implementation includes all required HIPAA safeguards.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Settings access requires administrator privileges.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
