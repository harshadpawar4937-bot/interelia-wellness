export function ImportLoadingOverlay({
  open,
  title = 'Importing data…',
  subtitle = 'Large files can take a minute. Please keep this tab open.',
}: {
  open: boolean
  title?: string
  subtitle?: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-[1px]">
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-white p-6 text-center shadow-lg">
        <div
          className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-brand border-t-transparent"
          aria-hidden
        />
        <p className="mt-4 font-display text-lg font-semibold">{title}</p>
        <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
      </div>
    </div>
  )
}
