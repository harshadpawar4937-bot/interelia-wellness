import { ImagePlus, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { mediaSrc } from '@/lib/api'

type Props = {
  imageUrl: string
  productName?: string
  disabled?: boolean
  uploading?: boolean
  onUrlChange: (url: string) => void
  onUpload: (file: File) => void | Promise<void>
  /** Compact row thumbnail vs full form editor */
  variant?: 'form' | 'thumb'
  onThumbClick?: () => void
}

export function ProductImageField({
  imageUrl,
  productName = 'Product',
  disabled,
  uploading,
  onUrlChange,
  onUpload,
  variant = 'form',
  onThumbClick,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const src = mediaSrc(imageUrl)

  function pickFile(file: File | undefined) {
    if (!file || disabled || uploading) return
    if (!file.type.startsWith('image/')) return
    void onUpload(file)
  }

  if (variant === 'thumb') {
    return (
      <div className="relative">
        <button
          type="button"
          title={imageUrl ? 'Change image' : 'Add image'}
          disabled={disabled || uploading}
          className="group relative h-12 w-12 overflow-hidden rounded-lg border border-border bg-surface-secondary disabled:opacity-60"
          onClick={() => (onThumbClick ? onThumbClick() : inputRef.current?.click())}
        >
          {src ? (
            <img src={src} alt={productName} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-ink-faint">
              <ImagePlus size={18} />
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
            {uploading ? '…' : src ? 'Change' : 'Add'}
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            pickFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
    )
  }

  return (
    <div className="sm:col-span-2">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Product image</p>
      <div
        className={`flex flex-col gap-3 rounded-xl border border-dashed p-3 sm:flex-row sm:items-stretch ${
          dragOver ? 'border-brand bg-brand/5' : 'border-border bg-surface-secondary/40'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          pickFile(e.dataTransfer.files?.[0])
        }}
      >
        <div className="relative mx-auto h-36 w-36 shrink-0 overflow-hidden rounded-xl border border-border bg-white sm:mx-0">
          {src ? (
            <img src={src} alt={productName} className="h-full w-full object-contain p-1" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-ink-faint">
              <ImagePlus size={28} />
              <span className="text-xs">No image</span>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <p className="text-sm text-ink-muted">
            JPG, PNG, or WEBP. Drag & drop onto this area, or upload from your computer. This image shows on the
            storefront product card and detail page.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled || uploading}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm text-white disabled:opacity-50"
              onClick={() => inputRef.current?.click()}
            >
              <Upload size={14} />
              {uploading ? 'Uploading…' : src ? 'Replace image' : 'Upload image'}
            </button>
            {src && (
              <button
                type="button"
                disabled={disabled || uploading}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-2 text-sm text-ink-muted disabled:opacity-50"
                onClick={() => onUrlChange('')}
              >
                <Trash2 size={14} />
                Remove
              </button>
            )}
          </div>
          <input
            className="w-full rounded border border-border bg-white px-3 py-2 text-xs text-ink-muted"
            placeholder="Or paste image URL"
            value={imageUrl}
            disabled={disabled}
            onChange={(e) => onUrlChange(e.target.value)}
          />
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          pickFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
