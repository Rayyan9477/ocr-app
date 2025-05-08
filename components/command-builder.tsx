"use client"

import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"

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
      <div className="space-y-2">
        <Label htmlFor="language">OCR Language</Label>
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="rotate">Page Rotation</Label>
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="optimize">Optimization Level (0-3)</Label>
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
          <span className="w-8 text-center">{options.optimize}</span>
        </div>
      </div>

      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="deskew" className="cursor-pointer">
            Deskew Pages
          </Label>
          <Switch id="deskew" checked={options.deskew} onCheckedChange={(checked) => handleChange("deskew", checked)} />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="skipText" className="cursor-pointer">
            Skip Text Detection
          </Label>
          <Switch
            id="skipText"
            checked={options.skipText}
            onCheckedChange={(checked) => handleChange("skipText", checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="force" className="cursor-pointer">
            Force OCR
          </Label>
          <Switch id="force" checked={options.force} onCheckedChange={(checked) => handleChange("force", checked)} />
        </div>
        
        <div className="flex items-center justify-between">
          <Label htmlFor="redoOcr" className="cursor-pointer">
            Redo OCR (Remove existing OCR)
          </Label>
          <Switch id="redoOcr" checked={options.redoOcr} onCheckedChange={(checked) => handleChange("redoOcr", checked)} />
        </div>
        
        <div className="flex items-center justify-between">
          <Label htmlFor="removeBackground" className="cursor-pointer">
            Remove Background
          </Label>
          <Switch id="removeBackground" checked={options.removeBackground} onCheckedChange={(checked) => handleChange("removeBackground", checked)} />
        </div>
        
        <div className="flex items-center justify-between">
          <Label htmlFor="clean" className="cursor-pointer">
            Clean Pages
          </Label>
          <Switch id="clean" checked={options.clean} onCheckedChange={(checked) => handleChange("clean", checked)} />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="pdfRenderer">PDF Renderer</Label>
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
        <p className="text-xs text-muted-foreground mt-1">
          Different renderers may produce better results for different documents
        </p>
      </div>
    </div>
  )
}
