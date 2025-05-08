"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { FileX, Upload } from "lucide-react"

interface FileUploaderProps {
  onFileUpload: (files: File[]) => void
  files: File[]
  onRemoveFile: (index: number) => void
}

export function FileUploader({ onFileUpload, files, onRemoveFile }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const validateFileSize = (file: File): boolean => {
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    return file.size <= MAX_FILE_SIZE;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    // Filter for PDF files
    const pdfFiles = Array.from(e.dataTransfer.files).filter(
      (file) => file.type === "application/pdf"
    );

    // Filter out files that are too large
    const validFiles = pdfFiles.filter((file) => {
      const isValid = validateFileSize(file);
      if (!isValid) {
        alert(`File "${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(2)} MB). Maximum size is 100MB.`);
      }
      return isValid;
    });

    if (validFiles.length > 0) {
      onFileUpload(validFiles);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Filter for PDF files
      const pdfFiles = Array.from(e.target.files).filter(
        (file) => file.type === "application/pdf"
      );

      // Filter out files that are too large
      const validFiles = pdfFiles.filter((file) => {
        const isValid = validateFileSize(file);
        if (!isValid) {
          alert(`File "${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(2)} MB). Maximum size is 100MB.`);
        }
        return isValid;
      });

      if (validFiles.length > 0) {
        onFileUpload(validFiles);
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors ${
          isDragging ? "border-primary bg-primary/10" : "border-gray-300"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleButtonClick}
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">Drag and drop PDF files here, or click to select files</p>
        <p className="mt-1 text-xs text-gray-500">Maximum file size: 100MB</p>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          accept=".pdf"
          multiple
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Uploaded Files:</h3>
          <ul className="space-y-2">
            {files.map((file, index) => (
              <li key={index} className="flex items-center justify-between bg-gray-100 p-2 rounded-md">
                <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                <Button variant="ghost" size="icon" onClick={() => onRemoveFile(index)} className="h-8 w-8">
                  <FileX className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
