'use client'

import { useState, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  maxTags?: number
  className?: string
  disabled?: boolean
}

export function TagInput({
  value,
  onChange,
  placeholder = 'Adicionar tag...',
  maxTags = 20,
  className,
  disabled = false,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim().toLowerCase()
      if (!trimmed) return
      if (value.includes(trimmed)) return
      if (value.length >= maxTags) return
      onChange([...value, trimmed])
    },
    [value, onChange, maxTags]
  )

  const removeTag = useCallback(
    (index: number) => {
      const next = [...value]
      next.splice(index, 1)
      onChange(next)
    },
    [value, onChange]
  )

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(inputValue)
      setInputValue('')
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value.length - 1)
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text')
    const tags = pasted.split(/[,;\n]+/)
    for (const tag of tags) {
      addTag(tag)
    }
    setInputValue('')
  }

  return (
    <div
      className={cn(
        'flex min-h-8 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5 text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag, index) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
        >
          {tag}
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                removeTag(index)
              }}
              className="rounded-sm hover:bg-primary/20"
              aria-label={`Remover tag ${tag}`}
            >
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
      {!disabled && value.length < maxTags && (
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={value.length === 0 ? placeholder : ''}
          className="h-auto min-w-[80px] flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent"
          disabled={disabled}
        />
      )}
    </div>
  )
}
