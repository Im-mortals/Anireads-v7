'use client'

import { useEffect, useRef, useState } from 'react'
import { PageFlip } from 'page-flip'
import PageLoader from './page-loader'

interface FlipBookProps {
  pages: Array<{
    url: string
    loaded: boolean
    error: boolean
    width?: number
    height?: number
  }>
  currentPage: number
  onPageChange: (page: number) => void
  onPageLoad: (index: number, dimensions: { width: number; height: number }) => void
  onPageError: (index: number) => void
  className?: string
}

export default function FlipBook({
  pages,
  currentPage,
  onPageChange,
  onPageLoad,
  onPageError,
  className = ''
}: FlipBookProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pageFlipRef = useRef<PageFlip | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    if (!containerRef.current || pages.length === 0) return

    // Initialize PageFlip
    const pageFlip = new PageFlip(containerRef.current, {
      width: 400,
      height: 600,
      size: 'stretch',
      minWidth: 300,
      maxWidth: 800,
      minHeight: 400,
      maxHeight: 1200,
      maxShadowOpacity: 0.5,
      showCover: false,
      mobileScrollSupport: false,
      clickEventForward: true,
      usePortrait: false,
      startPage: currentPage,
      drawShadow: true,
      flippingTime: 600,
      useMouseEvents: true,
      swipeDistance: 30,
      showPageCorners: true,
      disableFlipByClick: false
    })

    pageFlipRef.current = pageFlip

    // Create page elements
    const pageElements = pages.map((_, index) => {
      const pageDiv = document.createElement('div')
      pageDiv.className = 'page relative w-full h-full bg-white'
      pageDiv.setAttribute('data-page', index.toString())
      return pageDiv
    })

    // Load pages into PageFlip
    pageFlip.loadFromHTML(pageElements)

    // Event listeners
    pageFlip.on('flip', (e) => {
      onPageChange(e.data)
    })

    pageFlip.on('changeState', (e) => {
      console.log('PageFlip state changed:', e)
    })

    setIsInitialized(true)

    return () => {
      if (pageFlipRef.current) {
        pageFlipRef.current.destroy()
      }
    }
  }, [pages.length])

  // Update current page when prop changes
  useEffect(() => {
    if (pageFlipRef.current && isInitialized && currentPage !== pageFlipRef.current.getCurrentPageIndex()) {
      pageFlipRef.current.flip(currentPage)
    }
  }, [currentPage, isInitialized])

  // Render pages with content
  useEffect(() => {
    if (!pageFlipRef.current || !isInitialized) return

    pages.forEach((page, index) => {
      const pageElement = containerRef.current?.querySelector(`[data-page="${index}"]`) as HTMLElement
      if (!pageElement) return

      // Clear existing content
      pageElement.innerHTML = ''

      // Create page content container
      const contentDiv = document.createElement('div')
      contentDiv.className = 'absolute inset-0'
      
      if (page.url) {
        const img = document.createElement('img')
        img.src = page.url
        img.className = 'w-full h-full object-contain'
        img.onload = () => {
          onPageLoad(index, { width: img.naturalWidth, height: img.naturalHeight })
        }
        img.onerror = () => {
          onPageError(index)
        }
        contentDiv.appendChild(img)
      } else {
        // Show skeleton
        const skeleton = document.createElement('div')
        skeleton.className = 'w-full h-full bg-gray-200 animate-pulse'
        contentDiv.appendChild(skeleton)
      }

      pageElement.appendChild(contentDiv)
    })

    // Update PageFlip
    pageFlipRef.current.update()
  }, [pages, isInitialized, onPageLoad, onPageError])

  return (
    <div className={`flip-book-container ${className}`}>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}