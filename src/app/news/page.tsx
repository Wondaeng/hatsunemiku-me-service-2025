import { Suspense } from 'react'
import Link from 'next/link'
import { CalendarDays, Newspaper } from 'lucide-react'
import Pagination from '../../components/Pagination'
import { getNewsByCategory, countNewsByCategory } from '@/lib/newsService'
import { Category } from '../../generated/prisma/enums'

const ITEMS_PER_PAGE = 10

async function NewsList({ searchParams }: Readonly<{ searchParams: Promise<{ page?: string; tab?: string }> }>) {
  const resolvedSearchParams = await searchParams
  const currentPage = Number(resolvedSearchParams?.page) || 1
  const activeTab = resolvedSearchParams?.tab === 'vocaloid' ? 'vocaloid' : 'hatsuneMiku'
  const category = activeTab === 'vocaloid' ? Category.VOCALOID : Category.HATSUNE_MIKU

  const [items, totalCount] = await Promise.all([
    getNewsByCategory(category, currentPage, ITEMS_PER_PAGE),
    countNewsByCategory(category),
  ])

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  return (
    <main className="mx-auto max-w-4xl py-12 px-4">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-white mb-4 tracking-wider">보컬로이드 뉴스</h1>
        <p className="text-lg text-gray-300">다양한 플랫폼에서 수집하여 뉴스를 제공하고 있습니다!</p>
      </div>

      <div className="mb-12 flex justify-center">
        <div className="relative flex w-full max-w-xs items-center rounded-full bg-black/25 p-1">
          <div
            className={`absolute h-full top-0 left-0 w-1/2 rounded-full transition-transform duration-300 ease-in-out p-1 ${
              activeTab === 'hatsuneMiku' ? 'translate-x-0' : 'translate-x-full'
            }`}>
            <div className="w-full h-full rounded-full bg-cyan-400/90" />
          </div>
          <Link
            href="/news?tab=hatsuneMiku"
            className="relative z-10 flex-1 rounded-full py-2 text-center font-semibold text-sm transition-colors duration-300"
          >
            <span className={activeTab === 'hatsuneMiku' ? 'text-black' : 'text-white/80'}>하츠네 미쿠</span>
          </Link>
          <Link
            href="/news?tab=vocaloid"
            className="relative z-10 flex-1 rounded-full py-2 text-center font-semibold text-sm transition-colors duration-300"
          >
            <span className={activeTab === 'vocaloid' ? 'text-black' : 'text-white/80'}>보컬로이드</span>
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.id} className="bg-white/5 rounded-xl border border-white/10 flex overflow-hidden transition-all duration-300 hover:border-cyan-400/50 hover:bg-white/10">
              <div className="flex-shrink-0 flex items-center justify-center w-20 bg-black/10 border-r border-white/5">
                <Newspaper size={28} className="text-white/50" />
              </div>
              <div className="p-5 flex-grow">
                {item.date && (
                  <div className="flex items-center gap-2.5 mb-3">
                    <CalendarDays size={16} className="text-cyan-400/80" />
                    <span className="font-semibold text-sm text-white/80 tracking-wide">
                      {item.date.toISOString().split('T')[0]}
                    </span>
                  </div>
                )}
                <div
                  className="prose prose-invert prose-sm max-w-none text-gray-300 prose-a:text-cyan-400 hover:prose-a:text-cyan-300 prose-p:my-1"
                  dangerouslySetInnerHTML={{ __html: item.htmlContent || '' }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
            <p className="text-xl text-gray-500">관련 뉴스를 찾을 수 없습니다.</p>
            <p className="text-sm text-gray-600 mt-2">아직 뉴스가 수집되지 않았습니다.</p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} basePath={`/news?tab=${activeTab}`} />
      )}
    </main>
  )
}

export default async function NewsPage({ searchParams }: Readonly<{ searchParams: Promise<{ page?: string; tab?: string }> }>) {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-white">Loading...</div>}>
      <NewsList searchParams={searchParams} />
    </Suspense>
  )
}
