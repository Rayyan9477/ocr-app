"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";

interface User {
  id: string;
  email: string;
  role: string;
  mfaEnabled: boolean;
}

interface HIPAAAuthProps {
  onAuthSuccess: (user: User) => void;
  className?: string;
}

export function HIPAAAuth({ onAuthSuccess, className }: HIPAAAuthProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [requiresMFA, setRequiresMFA] = useState(false);
  
  // Login form state
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
    mfaCode: ""
  });

  const handleLogin = async (e: React.FormEvent) => {
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
          email: loginData.email,
          password: loginData.password,
          mfaCode: requiresMFA ? loginData.mfaCode : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store token if provided
        if (data.token) {
          localStorage.setItem('hipaa_token', data.token);
        }
        
        onAuthSuccess(data.user);
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
    <div className={`w-full max-w-md mx-auto ${className}`}>
      <Card>
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-2">
            <Shield className="h-8 w-8 text-blue-600 mr-2" />
            <Lock className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="text-xl font-bold">HIPAA-Compliant Access</CardTitle>
          <CardDescription>
            Secure authentication for healthcare data processing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              <AlertCircle className="h-4 w-4 inline mr-2" />
              This system uses a predefined administrator account.
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Contact your system administrator for access credentials.
            </p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={loginData.email}
                onChange={(e) => setLoginData(prev => ({
                  ...prev,
                  email: e.target.value
                }))}
                required
                disabled={isLoading}
                placeholder="Enter admin email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={loginData.password}
                  onChange={(e) => setLoginData(prev => ({
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
                  value={loginData.mfaCode}
                  onChange={(e) => setLoginData(prev => ({
                    ...prev,
                    mfaCode: e.target.value
                  }))}
                  required
                  disabled={isLoading}
                  placeholder="Enter 6-digit code"
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
          
          <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-start">
              <Shield className="h-4 w-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-xs text-blue-800">
                <strong>HIPAA Compliance:</strong> All data is encrypted in transit and at rest. 
                Access is logged and monitored for audit compliance.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
