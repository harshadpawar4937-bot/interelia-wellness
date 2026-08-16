import { Link, useParams, useSearchParams, Navigate } from 'react-router-dom'
import { blogs, getBlogBySlug } from '@/data/catalog'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

export function HealthHubPage() {
  const [params] = useSearchParams()
  const cat = params.get('cat')
  const q = params.get('q')?.toLowerCase() ?? ''

  const list = blogs.filter((b) => {
    if (cat && b.category !== cat) return false
    if (q && !b.title.toLowerCase().includes(q) && !b.excerpt.toLowerCase().includes(q)) return false
    return true
  })

  const categories = [...new Set(blogs.map((b) => b.category))]

  return (
    <div className="container-brand py-8 lg:py-12">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Health Hub</h1>
        <p className="mt-3 text-ink-muted">
          SEO-optimized guides, disease awareness, and preventive healthcare from Interelia experts.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link
          to="/health"
          className={`rounded-md px-3 py-1.5 text-sm ${!cat ? 'bg-brand text-white' : 'border border-border hover:border-brand'}`}
        >
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c}
            to={`/health?cat=${encodeURIComponent(c)}`}
            className={`rounded-md px-3 py-1.5 text-sm ${cat === c ? 'bg-brand text-white' : 'border border-border hover:border-brand'}`}
          >
            {c}
          </Link>
        ))}
      </div>

      <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((post) => (
          <article key={post.id}>
            <Link to={`/health/${post.slug}`} className="group block">
              <div className="aspect-[16/10] overflow-hidden rounded-xl">
                <img src={post.image} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
              </div>
              <p className="mt-3 text-xs font-semibold uppercase text-brand">{post.category}</p>
              <h2 className="mt-1 font-display text-lg font-semibold group-hover:text-brand">{post.title}</h2>
              <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{post.excerpt}</p>
              <p className="mt-2 text-xs text-ink-faint">
                {post.author} · {post.readingTime} min · {formatDate(post.publishedAt)}
              </p>
            </Link>
          </article>
        ))}
      </div>

      <div className="mt-16 rounded-2xl bg-brand-soft p-8 text-center lg:p-12">
        <h2 className="font-display text-2xl font-bold">Stay informed</h2>
        <p className="mt-2 text-ink-muted">Weekly wellness newsletter — tips, guides, and Interelia updates.</p>
        <form
          className="mx-auto mt-6 flex max-w-md flex-col gap-2 sm:flex-row"
          onSubmit={(e) => e.preventDefault()}
        >
          <input
            type="email"
            required
            placeholder="Your email"
            className="flex-1 rounded-md border border-border bg-white px-4 py-2.5 text-sm"
          />
          <Button type="submit">Subscribe</Button>
        </form>
      </div>
    </div>
  )
}

export function BlogArticlePage() {
  const { slug } = useParams()
  const post = slug ? getBlogBySlug(slug) : undefined
  if (!post) return <Navigate to="/health" replace />

  const related = blogs.filter((b) => b.id !== post.id && b.category === post.category).slice(0, 2)

  return (
    <article className="container-brand py-8 lg:py-12">
      <nav className="mb-6 text-sm text-ink-muted">
        <Link to="/health" className="hover:text-brand">Health Hub</Link>
        <span className="mx-2">/</span>
        <span>{post.category}</span>
      </nav>
      <header className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">{post.category}</p>
        <h1 className="mt-2 font-display text-3xl font-bold leading-tight sm:text-4xl">{post.title}</h1>
        <p className="mt-4 text-sm text-ink-muted">
          By {post.author}, {post.authorRole} · {post.readingTime} min read · {formatDate(post.publishedAt)}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {post.tags.map((t) => (
            <span key={t} className="rounded bg-surface-secondary px-2 py-0.5 text-xs text-ink-muted">
              #{t}
            </span>
          ))}
        </div>
      </header>
      <img
        src={post.image}
        alt=""
        className="mx-auto mt-8 aspect-[21/9] w-full max-w-4xl rounded-2xl object-cover"
      />
      <div className="mx-auto mt-10 max-w-3xl whitespace-pre-line text-base leading-relaxed text-ink">
        {post.content}
      </div>
      <div className="mx-auto mt-8 flex max-w-3xl gap-2">
        <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(window.location.href)}>
          Share link
        </Button>
      </div>
      {related.length > 0 && (
        <section className="mx-auto mt-16 max-w-3xl border-t border-border pt-10">
          <h2 className="font-display text-xl font-bold">Related articles</h2>
          <ul className="mt-4 space-y-3">
            {related.map((r) => (
              <li key={r.id}>
                <Link to={`/health/${r.slug}`} className="font-medium hover:text-brand">
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
