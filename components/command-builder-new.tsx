"use client"

import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { SettingsLayout } from "@/components/settings-layout"
import { Languages, Rotate, BookOpen, FileOutput, Cog, Gauge, Zap } from "lucide-react"

interface CommandBuilderProps {
  options: {
    language: string
    deskew: boolean
    skipText: boolean
    force: boolean
    redoOcr: boolean
    removeBackground: boolean
    clean: boolean
    optimize: number
    outputFormat: string
    rotate: string
    pdfRenderer: string
  }
  onChange: (options: any) => void
}

export function CommandBuilder({ options, onChange }: CommandBuilderProps) {
  const handleChange = (key: string, value: any) => {
    onChange({ ...options, [key]: value })
  }

  return (
    <div className="space-y-4">
      <SettingsLayout 
        title="OCR Language" 
        icon={<Languages className="h-4 w-4" />}
        description="Select the language for OCR text recognition"
        tooltip="Choose the primary language of the document for best OCR results"
      >
        <Select value={options.language} onValueChange={(value) => handleChange("language", value)}>
          <SelectTrigger id="language">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="eng">English</SelectItem>
            <SelectItem value="fra">French</SelectItem>
            <SelectItem value="deu">German</SelectItem>
            <SelectItem value="spa">Spanish</SelectItem>
            <SelectItem value="ita">Italian</SelectItem>
            <SelectItem value="rus">Russian</SelectItem>
            <SelectItem value="chi_sim">Chinese (Simplified)</SelectItem>
            <SelectItem value="jpn">Japanese</SelectItem>
          </SelectContent>
        </Select>
      </SettingsLayout>

      <SettingsLayout 
        title="Page Rotation" 
        icon={<Rotate className="h-4 w-4" />}
        description="Control how pages are rotated during processing"
        tooltip="Auto will automatically detect and fix page orientation"
      >
        <Select value={options.rotate} onValueChange={(value) => handleChange("rotate", value)}>
          <SelectTrigger id="rotate">
            <SelectValue placeholder="Select rotation option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="0">None</SelectItem>
            <SelectItem value="90">90°</SelectItem>
            <SelectItem value="180">180°</SelectItem>
            <SelectItem value="270">270°</SelectItem>
          </SelectContent>
        </Select>
      </SettingsLayout>

      <SettingsLayout 
        title="Optimization Level" 
        icon={<Gauge className="h-4 w-4" />}
        description="Higher values result in smaller files but may reduce quality"
        tooltip="0=None, 1=Basic, 2=Medium, 3=Aggressive optimization"
      >
        <div className="flex items-center space-x-2">
          <Slider
            id="optimize"
            min={0}
            max={3}
            step={1}
            value={[options.optimize]}
            onValueChange={(value) => handleChange("optimize", value[0])}
            className="flex-1"
          />
          <span className="w-8 text-center font-medium">{options.optimize}</span>
        </div>
      </SettingsLayout>

      <SettingsLayout 
        title="PDF Processing Options" 
        icon={<Cog className="h-4 w-4" />}
        description="Configure how PDFs are processed"
        tooltip="These options control the OCR behavior and output quality"
      >
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="deskew" className="cursor-pointer text-sm">
              Deskew Pages
            </Label>
            <Switch id="deskew" checked={options.deskew} onCheckedChange={(checked) => handleChange("deskew", checked)} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="skipText" className="cursor-pointer text-sm">
              Skip Text Detection
            </Label>
            <Switch
              id="skipText"
              checked={options.skipText}
              onCheckedChange={(checked) => handleChange("skipText", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="force" className="cursor-pointer text-sm">
              Force OCR
            </Label>
            <Switch id="force" checked={options.force} onCheckedChange={(checked) => handleChange("force", checked)} />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="redoOcr" className="cursor-pointer text-sm">
              Redo OCR
            </Label>
            <Switch id="redoOcr" checked={options.redoOcr} onCheckedChange={(checked) => handleChange("redoOcr", checked)} />
          </div>
        </div>
      </SettingsLayout>
      
      <SettingsLayout 
        title="Image Enhancement" 
        icon={<Zap className="h-4 w-4" />}
        description="Options to improve image quality"
        tooltip="These settings can improve OCR results for difficult documents"
      >
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="removeBackground" className="cursor-pointer text-sm">
              Remove Background
            </Label>
            <Switch id="removeBackground" checked={options.removeBackground} onCheckedChange={(checked) => handleChange("removeBackground", checked)} />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="clean" className="cursor-pointer text-sm">
              Clean Pages
            </Label>
            <Switch id="clean" checked={options.clean} onCheckedChange={(checked) => handleChange("clean", checked)} />
          </div>
        </div>
      </SettingsLayout>
      
      <SettingsLayout 
        title="PDF Renderer" 
        icon={<FileOutput className="h-4 w-4" />}
        description="Select the PDF rendering engine"
        tooltip="Different renderers may produce better results for different documents"
      >
        <Select value={options.pdfRenderer} onValueChange={(value) => handleChange("pdfRenderer", value)}>
          <SelectTrigger id="pdfRenderer">
            <SelectValue placeholder="Select PDF renderer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto (Default)</SelectItem>
            <SelectItem value="hocr">HOCR</SelectItem>
            <SelectItem value="sandwich">Sandwich</SelectItem>
          </SelectContent>
        </Select>
      </SettingsLayout>
    </div>
  )
}
