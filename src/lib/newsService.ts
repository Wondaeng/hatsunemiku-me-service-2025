import crypto from 'crypto'
import { prisma } from './prisma'
import { Category } from '../generated/prisma/enums'

function generateExternalId(date: string | null, htmlContent: string): string {
  const rawId = `${date || 'no-date'}-${htmlContent.slice(0, 150)}`
  return crypto.createHash('md5').update(rawId).digest('hex')
}

export async function upsertNewsItems(
  items: { date: string | null; htmlContent: string | null }[],
  category: Category
) {
  const results = await Promise.all(
    items.map(async (item) => {
      if (!item.htmlContent) return null
      
      const externalId = generateExternalId(item.date, item.htmlContent)
      
      return prisma.newsItem.upsert({
        where: { externalId },
        update: {
          htmlContent: item.htmlContent,
          scrapedAt: new Date(),
        },
        create: {
          externalId,
          date: item.date ? new Date(item.date) : null,
          htmlContent: item.htmlContent,
          category,
          createdAt: new Date(),
          scrapedAt: new Date(),
        },
      })
    })
  )
  
  return results.filter(Boolean)
}

export async function getNewsByCategory(
  category: Category,
  page: number,
  itemsPerPage: number
) {
  return prisma.newsItem.findMany({
    where: { category },
    orderBy: { date: 'desc' },
    skip: (page - 1) * itemsPerPage,
    take: itemsPerPage,
  })
}

export async function countNewsByCategory(category: Category) {
  return prisma.newsItem.count({ where: { category } })
}
