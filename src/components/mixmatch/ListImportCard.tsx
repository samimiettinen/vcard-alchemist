import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileSpreadsheet, X, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { SourceFile } from '@/types/database'
import type { ListRole } from '@/hooks/useEnrichmentEngine'

interface ListImportCardProps {
  role: ListRole
  title: string
  description: string
  sourceFile: SourceFile | null
  contactCount: number
  isProcessing: boolean
  error: string | null
  onImport: (file: File) => Promise<void>
  onRemove: () => void
  disabled?: boolean
}

const roleColors = {
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  tertiary: 'bg-muted text-muted-foreground'
}

const roleBadgeVariants = {
  primary: 'default' as const,
  secondary: 'secondary' as const,
  tertiary: 'outline' as const
}

export function ListImportCard({
  role,
  title,
  description,
  sourceFile,
  contactCount,
  isProcessing,
  error,
  onImport,
  onRemove,
  disabled = false
}: ListImportCardProps) {
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      await onImport(acceptedFiles[0])
    }
  }, [onImport])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false,
    disabled: disabled || isProcessing
  })

  return (
    <Card className={`flex flex-col ${disabled ? 'opacity-50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={roleBadgeVariants[role]}>{title}</Badge>
            {sourceFile && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRemove}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="flex-1">
        {sourceFile ? (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <FileSpreadsheet className="h-5 w-5 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{sourceFile.filename}</p>
              <p className="text-xs text-muted-foreground">
                {contactCount} kontaktia • {sourceFile.original_headers.length} saraketta
              </p>
            </div>
            <Badge variant="secondary" className="flex-shrink-0">
              <Check className="h-3 w-3 mr-1" />
              Tuotu
            </Badge>
          </div>
        ) : (
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-4 text-center cursor-pointer
              transition-colors duration-200 h-full min-h-[100px] flex flex-col items-center justify-center
              ${isDragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-primary/50'
              }
              ${isProcessing || disabled ? 'opacity-50 pointer-events-none' : ''}
            `}
          >
            <input {...getInputProps()} />
            <Upload className="h-6 w-6 mb-2 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-sm text-primary font-medium">Pudota tiedosto...</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Vedä ja pudota tai klikkaa
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-2 mt-2 bg-destructive/10 text-destructive rounded-lg text-xs">
            <AlertCircle className="h-3 w-3 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isProcessing && (
          <div className="flex items-center justify-center gap-2 p-2 mt-2">
            <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground">Käsitellään...</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
