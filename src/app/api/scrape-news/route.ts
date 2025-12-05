import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { upsertNewsItems } from '@/lib/newsService'
import { Category } from '../../../generated/prisma/enums'

// Google News RSS feed URLs (same source the wiki uses via #news() plugin)
const MIKU_RSS_URL = 'https://news.google.com/rss/search?q=%E5%88%9D%E9%9F%B3%E3%83%9F%E3%82%AF&hl=ja&gl=JP&ceid=JP:ja'
const VOCALOID_RSS_URL = 'https://news.google.com/rss/search?q=VOCALOID&hl=ja&gl=JP&ceid=JP:ja'

interface ScrapedItem {
  date: string | null
  htmlContent: string | null
}

async function fetchGoogleNewsRSS(rssUrl: string, category: string): Promise<ScrapedItem[]> {
  try {
    const response = await fetch(rssUrl, { 
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)'
      }
    })
    
    if (!response.ok) {
      console.error(`Failed to fetch ${category} RSS: ${response.statusText}`)
      return []
    }
    
    const xml = await response.text()
    const $ = cheerio.load(xml, { xmlMode: true })
    
    const items: ScrapedItem[] = []
    
    $('item').each((index, element) => {
      // Limit to 50 items per category
      if (index >= 50) return false
      
      const title = $(element).find('title').text()
      const link = $(element).find('link').text()
      const pubDate = $(element).find('pubDate').text()
      const source = $(element).find('source').text()
      
      // Parse the publication date
      let date: string | null = null
      if (pubDate) {
        const parsed = new Date(pubDate)
        if (!isNaN(parsed.getTime())) {
          date = parsed.toISOString().split('T')[0] // YYYY-MM-DD format
        }
      }
      
      // Create HTML content similar to original wiki format
      const htmlContent = `<a href="${link}" target="_blank" rel="noopener noreferrer">${title}</a>${source ? ` - ${source}` : ''}`
      
      items.push({
        date,
        htmlContent,
      })
    })
    
    console.log(`Fetched ${items.length} items for ${category}`)
    return items
  } catch (error) {
    console.error(`Failed to fetch ${category} RSS:`, error)
    return []
  }
}

async function scrapeNewsFromRSS(): Promise<{ hatsuneMiku: ScrapedItem[]; vocaloid: ScrapedItem[] }> {
  try {
    const [hatsuneMiku, vocaloid] = await Promise.all([
      fetchGoogleNewsRSS(MIKU_RSS_URL, 'hatsuneMiku'),
      fetchGoogleNewsRSS(VOCALOID_RSS_URL, 'vocaloid')
    ])
    
    console.log('Final counts - Miku:', hatsuneMiku.length, 'Vocaloid:', vocaloid.length)
    return { hatsuneMiku, vocaloid }
  } catch (error) {
    console.error('Failed to fetch news from RSS:', error)
    return { hatsuneMiku: [], vocaloid: [] }
  }
}

export async function GET() {
  // Allow access in development without auth
  const isDev = process.env.NODE_ENV === 'development'
  
  if (!isDev) {
    // In production, require authorization
    // Add auth check here later
  }

  try {
    const { hatsuneMiku, vocaloid } = await scrapeNewsFromRSS()

    const mikuResults = await upsertNewsItems(hatsuneMiku, Category.HATSUNE_MIKU)
    const vocaloidResults = await upsertNewsItems(vocaloid, Category.VOCALOID)

    return NextResponse.json({
      success: true,
      message: 'News fetched from Google News RSS and saved to database',
      counts: {
        hatsuneMiku: mikuResults.length,
        vocaloid: vocaloidResults.length,
      },
      scrapedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Scraping error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch news' },
      { status: 500 }
    )
  }
}
