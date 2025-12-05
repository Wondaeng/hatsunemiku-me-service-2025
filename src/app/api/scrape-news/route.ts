import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'
import { upsertNewsItems } from '@/lib/newsService'
import { Category } from '../../../generated/prisma/enums'

const TARGET_URL = 'https://w.atwiki.jp/hmiku/pages/912.html'

interface ScrapedItem {
  date: string | null
  htmlContent: string | null
}

async function scrapeWikiItems(): Promise<{ hatsuneMiku: ScrapedItem[]; vocaloid: ScrapedItem[] }> {
  try {
    const response = await fetch(TARGET_URL, { 
      cache: 'no-store'
    })
    if (!response.ok) {
      console.error(`Failed to fetch data: ${response.statusText}`)
      return { hatsuneMiku: [], vocaloid: [] }
    }
    const html = await response.text()
    
    // Debug: log first 500 chars to see if we got real content or Cloudflare
    console.log('HTML preview:', html.substring(0, 500))
    
    const $ = cheerio.load(html)

    const hatsuneMiku: ScrapedItem[] = []
    const vocaloid: ScrapedItem[] = []

    // Debug: log the HTML structure
    console.log('Wikibody ul count:', $('#wikibody ul').length)

    const processNewsBlock = (newsBlock: cheerio.Cheerio<Element>, category: 'hatsuneMiku' | 'vocaloid') => {
      const items = category === 'hatsuneMiku' ? hatsuneMiku : vocaloid
      console.log(`Processing ${category}, found li count:`, newsBlock.find('ul.recent_list > li').length)
      
      newsBlock.find('ul.recent_list > li').each((_, liElement) => {
        $(liElement).find('a').attr('target', '_blank').attr('rel', 'noopener noreferrer')
        const fullHtml = $(liElement).html() || ''
        const cleanedHtml = fullHtml.replace(/、?タグ：.*/g, '')
        const textContent = $(liElement).text()
        const dateMatch = RegExp(/^(\d{4}-\d{2}-\d{2})/).exec(textContent)
        const date = dateMatch ? dateMatch[1] : null
        const contentHtml = date ? cleanedHtml.replace(new RegExp(`^${date}\\s*-\\s*`), '') : cleanedHtml

        items.push({
          date,
          htmlContent: contentHtml.trim(),
        })
      })
    }

    $('#wikibody ul').each((_, ul) => {
      const $ul = $(ul)
      const liHtml = $ul.find('li:first-child').html()
      console.log('Found ul with first li:', liHtml?.substring(0, 100))

      if (liHtml?.includes('初音ミク</span>を含むニュース')) {
        const newsBlock = $ul.next('div.plugin_gnews')
        console.log('Found Miku news block, length:', newsBlock.length)
        if (newsBlock.length) processNewsBlock(newsBlock, 'hatsuneMiku')
      } else if (liHtml?.includes('VOCALOID</span>を含むニュース')) {
        const newsBlock = $ul.next('div.plugin_gnews')
        console.log('Found Vocaloid news block, length:', newsBlock.length)
        if (newsBlock.length) processNewsBlock(newsBlock, 'vocaloid')
      }
    })

    console.log('Final counts - Miku:', hatsuneMiku.length, 'Vocaloid:', vocaloid.length)
    return { hatsuneMiku, vocaloid }
  } catch (error) {
    console.error('Failed to scrape wiki items:', error)
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
    const { hatsuneMiku, vocaloid } = await scrapeWikiItems()

    const mikuResults = await upsertNewsItems(hatsuneMiku, Category.HATSUNE_MIKU)
    const vocaloidResults = await upsertNewsItems(vocaloid, Category.VOCALOID)

    return NextResponse.json({
      success: true,
      message: 'News scraped and saved to database',
      counts: {
        hatsuneMiku: mikuResults.length,
        vocaloid: vocaloidResults.length,
      },
      scrapedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Scraping error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to scrape news' },
      { status: 500 }
    )
  }
}
