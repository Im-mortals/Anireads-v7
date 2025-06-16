'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

interface PageData {
  url: string
  loaded: boolean
  error: boolean
  width?: number
  height?: number
}

interface PageLoaderProps {
  page: PageData
  onLoad: (dimensions: { width: number; height: number }) => void
  onError: () => void
  className?: string
  priority?: boolean
}

export default function PageLoader({ 
  page, 
  onLoad, 
  onError, 
  className = '', 
  priority = false 
}: PageLoaderProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (page.url && !page.loaded && !page.error) {
      const img = new window.Image()
      
      img.onload = () => {
        onLoad({ width: img.naturalWidth, height: img.naturalHeight })
        setImageLoaded(true)
      }
      
      img.onerror = () => {
        onError()
        setImageError(true)
      }
      
      img.src = page.url
    }
  }, [page.url, page.loaded, page.error, onLoad, onError])

  if (imageError || page.error) {
    return (
      <div className={`flex items-center justify-center bg-gray-800 ${className}`}>
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-2">⚠️</div>
          <div>Failed to load page</div>
        </div>
      </div>
    )
  }

  if (!imageLoaded || !page.loaded) {
    return (
      <div className={`bg-gray-800 ${className}`}>
        <PageSkeleton />
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <Image
        ref={imgRef}
        src={page.url}
        alt="Manga page"
        fill
        className="object-contain"
        priority={priority}
        unoptimized
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
      />
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="w-full h-full animate-pulse bg-gray-700 relative overflow-hidden">
      {/* Manga page skeleton structure */}
      <div className="absolute inset-0 p-4 space-y-4">
        {/* Top panels */}
        <div className="flex gap-2 h-1/4">
          <div className="flex-1 bg-gray-600 rounded"></div>
          <div className="flex-1 bg-gray-600 rounded"></div>
        </div>
        
        {/* Middle large panel */}
        <div className="h-2/5 bg-gray-600 rounded"></div>
        
        {/* Bottom panels */}
        <div className="flex gap-2 h-1/4">
          <div className="w-1/3 bg-gray-600 rounded"></div>
          <div className="flex-1 bg-gray-600 rounded"></div>
        </div>
      </div>
      
      {/* Shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-500/20 to-transparent animate-shimmer"></div>
    </div>
  )
}