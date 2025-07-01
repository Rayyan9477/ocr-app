"use client"

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Lock, Eye, EyeOff, AlertCircle, ArrowLeft, LogIn } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [requiresMFA, setRequiresMFA] = useState(false);
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    mfaCode: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          mfaCode: requiresMFA ? formData.mfaCode : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store token if provided
        if (data.token) {
          localStorage.setItem('hipaa_token', data.token);
        }
        
        // Redirect to HIPAA interface
        router.push('/hipaa');
      } else {
        if (data.requiresMFA) {
          setRequiresMFA(true);
          setError("Please enter your MFA code");
        } else {
          setError(data.error || 'Login failed');
        }
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card>
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Shield className="h-8 w-8 text-blue-600 mr-2" />
              <LogIn className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold">HIPAA-Compliant Access</CardTitle>
            <CardDescription>
              Sign in to your secure healthcare data processing account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    email: e.target.value
                  }))}
                  required
                  disabled={isLoading}
                  placeholder="your.email@company.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      password: e.target.value
                    }))}
                    required
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {requiresMFA && (
                <div className="space-y-2">
                  <Label htmlFor="mfaCode">MFA Code</Label>
                  <Input
                    id="mfaCode"
                    type="text"
                    value={formData.mfaCode}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      mfaCode: e.target.value
                    }))}
                    required
                    disabled={isLoading}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                  />
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{" "}
                <Link href="/auth/register" className="font-medium text-blue-600 hover:text-blue-500">
                  Register here
                </Link>
              </p>
            </div>

            <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-start">
                <Shield className="h-4 w-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                <div className="text-xs text-blue-800">
                  <strong>HIPAA Compliance:</strong> All data is encrypted in transit and at rest. 
                  Access is logged and monitored for audit compliance.
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <div className="flex items-start">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 mr-2 flex-shrink-0" />
                <div className="text-xs text-amber-800">
                  <strong>Note:</strong> Contact your system administrator for admin access credentials.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Link 
            href="/" 
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
