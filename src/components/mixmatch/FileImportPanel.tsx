import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileSpreadsheet, X, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { SourceFile } from '@/types/database'

interface FileImportPanelProps {
  sourceFiles: SourceFile[]
  isProcessing: boolean
  error: string | null
  onImport: (files: File[]) => Promise<void>
  onClearAll: () => void
}

export function FileImportPanel({
  sourceFiles,
  isProcessing,
  error,
  onImport,
  onClearAll
}: FileImportPanelProps) {
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    await onImport(acceptedFiles)
  }, [onImport])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: true
  })

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Tuo lähteet</CardTitle>
          {sourceFiles.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onClearAll}>
              <X className="h-4 w-4 mr-1" />
              Tyhjennä
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
            transition-colors duration-200
            ${isDragActive 
              ? 'border-primary bg-primary/5' 
              : 'border-muted-foreground/25 hover:border-primary/50'
            }
            ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
          `}
        >
          <input {...getInputProps()} />
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          {isDragActive ? (
            <p className="text-sm text-primary font-medium">Pudota tiedostot tähän...</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Vedä ja pudota CSV/Excel-tiedostoja
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                tai klikkaa valitaksesi
              </p>
            </>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Imported files list */}
        {sourceFiles.length > 0 && (
          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {sourceFiles.map(file => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                >
                  <FileSpreadsheet className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {file.row_count} riviä • {file.original_headers.length} saraketta
                    </p>
                  </div>
                  <Badge variant="secondary" className="flex-shrink-0">
                    <Check className="h-3 w-3 mr-1" />
                    Tuotu
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex items-center justify-center gap-2 p-4">
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Käsitellään tiedostoja...</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
