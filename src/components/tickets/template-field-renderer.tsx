'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RichTextEditor } from '@/components/shared/rich-text-editor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface TemplateFieldDef {
  key: string
  label: string
  type?: string
  placeholder?: string
  required?: boolean
  options?: string[]
  validation?: { min?: number; max?: number; pattern?: string }
}

interface TemplateFieldRendererProps {
  field: TemplateFieldDef
  value: string
  onChange: (value: string) => void
}

export const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'number', label: 'Numero' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
  { value: 'url', label: 'URL' },
  { value: 'currency', label: 'Moeda (R$)' },
  { value: 'date', label: 'Data' },
  { value: 'file', label: 'Arquivo' },
  { value: 'select', label: 'Selecao' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'wysiwyg', label: 'Texto rico (WYSIWYG)' },
] as const

export function TemplateFieldRenderer({ field, value, onChange }: TemplateFieldRendererProps) {
  const type = field.type || 'text'
  const id = `field-${field.key}`

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">
        {field.label}
        {field.required && <span className="text-destructive ml-0.5">*</span>}
      </Label>

      {type === 'textarea' && (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
        />
      )}

      {type === 'number' && (
        <Input
          id={id}
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          min={field.validation?.min}
          max={field.validation?.max}
        />
      )}

      {type === 'email' && (
        <Input
          id={id}
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? 'email@exemplo.com'}
        />
      )}

      {type === 'phone' && (
        <Input
          id={id}
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? '(00) 00000-0000'}
        />
      )}

      {type === 'url' && (
        <Input
          id={id}
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? 'https://'}
        />
      )}

      {type === 'currency' && (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            R$
          </span>
          <Input
            id={id}
            type="number"
            step="0.01"
            min="0"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder ?? '0,00'}
            className="pl-10"
          />
        </div>
      )}

      {type === 'date' && (
        <Input
          id={id}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {type === 'file' && (
        <Input
          id={id}
          type="file"
          onChange={(e) => {
            const file = e.target.files?.[0]
            onChange(file?.name ?? '')
          }}
          className="cursor-pointer"
        />
      )}

      {type === 'select' && (
        <Select value={value} onValueChange={(v) => onChange(v ?? '')}>
          <SelectTrigger>
            <SelectValue placeholder={field.placeholder ?? 'Selecione'} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {type === 'checkbox' && (
        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            id={id}
            checked={value === 'true'}
            onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
          />
          <label htmlFor={id} className="text-sm cursor-pointer">
            {field.placeholder || field.label}
          </label>
        </div>
      )}

      {type === 'wysiwyg' && (
        <RichTextEditor
          content={value}
          onChange={(html, _text) => onChange(html)}
          placeholder={field.placeholder ?? 'Escreva aqui...'}
          minHeight="120px"
        />
      )}

      {type === 'text' && (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      )}
    </div>
  )
}
