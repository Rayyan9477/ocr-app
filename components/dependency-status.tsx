import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface Dependency {
  name: string;
  command: string;
  version?: string;
  available: boolean;
  error?: string;
  optional?: boolean;
}

interface DirectoryStatus {
  path: string;
  exists: boolean;
  writable: boolean;
  permissions?: string;
  error?: string;
}

interface DependencyStatusProps {
  showAll?: boolean;
  className?: string;
}

export function DependencyStatus({ showAll = false, className }: DependencyStatusProps) {
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allRequired, setAllRequired] = useState(false);
  const [allAvailable, setAllAvailable] = useState(false);
  const [directories, setDirectories] = useState<DirectoryStatus[]>([]);
  const [directoriesOk, setDirectoriesOk] = useState(false);

  useEffect(() => {
    const checkDependencies = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/check-dependencies');
        
        if (!response.ok) {
          throw new Error(`Error checking dependencies: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          setDependencies(data.dependencies);
          setAllRequired(data.allRequiredAvailable);
          setAllAvailable(data.allDependenciesAvailable);
          
          // Set directory status if available
          if (data.directories) {
            setDirectories(data.directories);
            setDirectoriesOk(data.directoriesOk);
          }
        } else {
          setError(data.error || 'Unknown error checking dependencies');
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    checkDependencies();
  }, []);

  // Filter to show only missing dependencies or all based on showAll prop
  const filteredDependencies = showAll 
    ? dependencies 
    : dependencies.filter(dep => !dep.available);

  return (
    <Card className={cn("w-full transition-all duration-300", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-4 w-4" />
            System Dependencies
          </CardTitle>
          {!isLoading && !error && (
            <div className="flex gap-1">
              <Badge 
                variant={allRequired ? "default" : "destructive"}
                className={cn(
                  "animate-in zoom-in duration-300",
                  allRequired 
                    ? "bg-green-100 text-green-800 hover:bg-green-200" 
                    : "hover:bg-red-200"
                )}
              >
                {allRequired ? (
                  <span className="flex items-center">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    All Required
                  </span>
                ) : (
                  <span className="flex items-center">
                    <XCircle className="h-3 w-3 mr-1" />
                    Missing Required
                  </span>
                )}
              </Badge>
              
              <Badge 
                variant={allAvailable ? "default" : "secondary"}
                className={cn(
                  "animate-in zoom-in duration-300",
                  allAvailable 
                    ? "bg-green-50 text-green-800 border-green-200 hover:bg-green-100" 
                    : "hover:bg-gray-200"
                )}
                style={{ animationDelay: '100ms' }}
              >
                <span className="flex items-center">
                  {allAvailable ? (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  ) : (
                    <AlertCircle className="h-3 w-3 mr-1" />
                  )}
                  Optional
                </span>
              </Badge>
            </div>
          )}
        </div>
        <CardDescription>
          OCR processing system requirements
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-4 text-center text-muted-foreground animate-pulse">
            <div className="flex justify-center mb-2">
              <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
            </div>
            Checking system dependencies...
          </div>
        ) : error ? (
          <div className="py-2 text-destructive">
            <AlertCircle className="h-4 w-4 inline mr-1" />
            {error}
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge 
                variant={allRequired ? "default" : "destructive"}
                className="animate-in zoom-in duration-300"
              >
                {allRequired ? (
                  <CheckCircle className="h-3 w-3 mr-1" />
                ) : (
                  <XCircle className="h-3 w-3 mr-1" />
                )}
                Required: {allRequired ? 'All Available' : 'Missing'}
              </Badge>
              
              <Badge 
                variant={allAvailable ? "default" : "outline"}
                className="animate-in zoom-in duration-300"
                style={{ animationDelay: '100ms' }}
              >
                {allAvailable ? (
                  <CheckCircle className="h-3 w-3 mr-1" />
                ) : (
                  <AlertCircle className="h-3 w-3 mr-1" />
                )}
                Optional: {allAvailable ? 'All Available' : 'Some Missing'}
              </Badge>
            </div>
            
            {filteredDependencies.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {filteredDependencies.map((dep, index) => (
                  <li 
                    key={dep.name} 
                    className={cn(
                      "p-3 rounded-md flex items-center justify-between animate-in slide-in-from-bottom-2 border",
                      dep.available 
                        ? "bg-green-50 border-green-100 text-green-900" 
                        : dep.optional 
                          ? "bg-yellow-50 border-yellow-100 text-yellow-900" 
                          : "bg-red-50 border-red-100 text-red-900"
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div>
                      <div className="flex items-center">
                        <span className="font-medium">{dep.name}</span>
                        {dep.optional && (
                          <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-gray-200 text-gray-800 rounded-md">
                            Optional
                          </span>
                        )}
                        {dep.version && (
                          <span className="text-xs text-muted-foreground ml-2">
                            v{dep.version}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center">
                        {!dep.available && (
                          <code className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] mr-1 border">{dep.command}</code>
                        )}
                        {dep.error && <span className="text-red-500 text-[10px] mt-1">{dep.error}</span>}
                      </div>
                    </div>
                    <Badge 
                      variant={
                        dep.available 
                          ? "default" 
                          : dep.optional 
                            ? "outline" 
                            : "destructive"
                      }
                    >
                      {dep.available ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : dep.optional ? (
                        <AlertCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      {dep.available 
                        ? "Available" 
                        : dep.optional 
                          ? "Optional - Not Found" 
                          : "Required - Missing!"
                      }
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-2 text-center text-muted-foreground">
                All dependencies are installed and working correctly.
              </div>
            )}

            {/* Display directory status */}
            {showAll && directories.length > 0 && (
              <div className="mt-6 space-y-4">
                <h3 className="text-sm font-medium">Directory Permissions</h3>
                <div className="space-y-3">
                  {directories.map((dir, index) => (
                    <div 
                      key={index}
                      className={cn(
                        "rounded-md border p-3",
                        dir.writable ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50",
                        "animate-in slide-in-from-bottom duration-300"
                      )}
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium truncate pr-2">
                          {dir.path.split('/').pop() || dir.path}
                        </div>
                        <Badge variant={dir.writable ? "default" : "destructive"}>
                          {dir.writable ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <XCircle className="h-3 w-3 mr-1" />
                          )}
                          {dir.writable ? 'Writable' : 'Not Writable'}
                        </Badge>
                      </div>
                      
                      <div className="mt-1 text-xs text-muted-foreground truncate">
                        {dir.path}
                      </div>
                      
                      {dir.error && (
                        <div className="mt-1 text-xs text-destructive">
                          {dir.error}
                        </div>
                      )}
                      
                      {dir.permissions && (
                        <div className="mt-1 text-xs font-mono">
                          {dir.permissions}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {!directoriesOk && (
                  <div className="mt-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 inline mr-1" />
                    Directory permission issues detected. Processing may fail.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
