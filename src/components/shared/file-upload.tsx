'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, File as FileIcon, Image, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface FileUploadProps {
  onUpload: (file: File) => Promise<void>
  accept?: string
  maxSize?: number // in bytes
  className?: string
  disabled?: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function isImageType(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

export function FileUpload({
  onUpload,
  accept,
  maxSize = 10 * 1024 * 1024, // 10MB default
  className,
  disabled = false,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [preview, setPreview] = useState<{
    name: string
    size: number
    type: string
    url?: string
  } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)

      if (file.size > maxSize) {
        setError(
          `Arquivo muito grande. Maximo: ${formatFileSize(maxSize)}`
        )
        return
      }

      // Show preview
      const previewData: typeof preview = {
        name: file.name,
        size: file.size,
        type: file.type,
      }

      if (isImageType(file.type)) {
        previewData.url = URL.createObjectURL(file)
      }
      setPreview(previewData)

      // Upload
      setUploading(true)
      setProgress(10)

      try {
        // Simulate progress steps
        const progressInterval = setInterval(() => {
          setProgress((prev) => Math.min(prev + 15, 90))
        }, 200)

        await onUpload(file)

        clearInterval(progressInterval)
        setProgress(100)

        // Reset after success
        setTimeout(() => {
          setPreview(null)
          setProgress(0)
        }, 1000)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Erro ao fazer upload'
        )
        setPreview(null)
        setProgress(0)
      } finally {
        setUploading(false)
      }
    },
    [maxSize, onUpload]
  )

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    if (!disabled) setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    if (disabled) return

    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  function clearPreview() {
    if (preview?.url) {
      URL.revokeObjectURL(preview.url)
    }
    setPreview(null)
    setError(null)
    setProgress(0)
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        className={cn(
          'relative flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors',
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          disabled && 'cursor-not-allowed opacity-50',
          uploading && 'pointer-events-none'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled || uploading}
        />

        {preview ? (
          <div className="flex w-full items-center gap-3">
            {preview.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.url}
                alt={preview.name}
                className="size-12 rounded-md object-cover"
              />
            ) : (
              <div className="flex size-12 items-center justify-center rounded-md bg-muted">
                <FileIcon className="size-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 text-left">
              <p className="truncate text-sm font-medium">{preview.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(preview.size)}
              </p>
              {uploading && (
                <Progress value={progress} className="mt-1 h-1.5" />
              )}
            </div>
            {!uploading && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  clearPreview()
                }}
              >
                <X className="size-3" />
              </Button>
            )}
            {uploading && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            )}
          </div>
        ) : (
          <>
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <Upload className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">
                Arraste um arquivo ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground">
                Maximo {formatFileSize(maxSize)}
              </p>
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
