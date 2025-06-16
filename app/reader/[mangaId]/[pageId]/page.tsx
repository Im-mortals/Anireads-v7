'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { 
  ChevronLeft, 
  ChevronRight, 
  Home, 
  Settings, 
  BookOpen,
  Maximize,
  Minimize,
  RotateCw,
  Volume2,
  VolumeX,
  Download,
  Bookmark,
  Share2,
  Eye,
  EyeOff,
  Smartphone,
  Monitor,
  ZoomIn,
  ZoomOut,
  SkipBack,
  SkipForward,
  X,
  Play,
  Pause,
  ScrollText,
  FlipHorizontal,
  FlipVertical,
  BookOpenCheck
} from 'lucide-react'
import { getMangaDxChapterPages, getMangaDxChapter, getMangaDxChapters } from '@/lib/mangadx-api'
import { toast } from 'sonner'
import Image from 'next/image'
import GestureHandler from '@/components/reader/gesture-handler'
import PageLoader from '@/components/reader/page-loader'
import FlipBook from '@/components/reader/flip-book'
import { motion, AnimatePresence } from 'framer-motion'

interface ReaderSettings {
  readingMode: 'single' | 'double' | 'webtoon' | 'scroll-vertical' | 'scroll-horizontal'
  flipDirection: 'rtl' | 'ltr'
  autoPlay: boolean
  autoPlaySpeed: number
  soundEnabled: boolean
  preloadPages: number
  showUI: boolean
  fullscreen: boolean
  zoom: number
  autoZoom: boolean
  fitMode: 'width' | 'height' | 'page' | 'original'
}

interface PageData {
  url: string
  loaded: boolean
  error: boolean
  width?: number
  height?: number
}

export default function MangaReaderPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const autoPlayIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const mangaId = params.mangaId as string
  const pageId = parseInt(params.pageId as string) || 1
  const chapterId = searchParams.get('chapter')

  const [pages, setPages] = useState<PageData[]>([])
  const [currentPage, setCurrentPage] = useState(pageId)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [chapterInfo, setChapterInfo] = useState<any>(null)
  const [allChapters, setAllChapters] = useState<any[]>([])
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0)
  const [preloadedPages, setPreloadedPages] = useState<Set<number>>(new Set())

  const [settings, setSettings] = useState<ReaderSettings>(() => {
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem('mangaReaderSettings')
      if (savedSettings) {
        return JSON.parse(savedSettings)
      }
    }
    return {
      readingMode: 'single',
      flipDirection: 'rtl',
      autoPlay: false,
      autoPlaySpeed: 10,
      soundEnabled: true,
      preloadPages: 2,
      showUI: true,
      fullscreen: false,
      zoom: 100,
      autoZoom: true,
      fitMode: 'width'
    }
  })

  const [showSettings, setShowSettings] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile devices
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Force landscape in mobile double page view
  useEffect(() => {
    if (isMobile && settings.readingMode === 'double') {
      try {
        // @ts-ignore
        screen.orientation?.lock('landscape')
      } catch (e) {
        console.log('Orientation lock not supported')
      }
    } else {
      try {
        // @ts-ignore
        screen.orientation?.unlock()
      } catch (e) {}
    }
  }, [isMobile, settings.readingMode])

  // Save settings to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mangaReaderSettings', JSON.stringify(settings))
    }
  }, [settings])

  // Load chapter data
  useEffect(() => {
    if (!chapterId) return

    const loadChapterData = async () => {
      try {
        setLoading(true)
        
        const chapterResponse = await getMangaDxChapter(chapterId)
        setChapterInfo(chapterResponse.data)

        const pagesResponse = await getMangaDxChapterPages(chapterId)
        const baseUrl = pagesResponse.baseUrl
        const chapterHash = pagesResponse.chapter.hash
        const pageFiles = pagesResponse.chapter.data

        const pageUrls = pageFiles.map((file: string) => ({
          url: `${baseUrl}/data/${chapterHash}/${file}`,
          loaded: false,
          error: false
        }))

        setPages(pageUrls)
        setTotalPages(pageUrls.length)

        const chaptersResponse = await getMangaDxChapters(mangaId)
        const sortedChapters = chaptersResponse.data.sort((a: any, b: any) => {
          const aNum = parseFloat(a.attributes.chapter || "0")
          const bNum = parseFloat(b.attributes.chapter || "0")
          return aNum - bNum
        })
        setAllChapters(sortedChapters)
        
        const currentIndex = sortedChapters.findIndex((ch: any) => ch.id === chapterId)
        setCurrentChapterIndex(currentIndex)

      } catch (error) {
        console.error('Error loading chapter:', error)
        toast.error('Failed to load chapter')
      } finally {
        setLoading(false)
      }
    }

    loadChapterData()
  }, [chapterId, mangaId])

  // Background page preloading
  const preloadPage = useCallback((index: number) => {
    if (index < 0 || index >= pages.length || preloadedPages.has(index)) return

    const page = pages[index]
    if (!page || page.loaded || page.error) return

    const img = new window.Image()
    img.onload = () => {
      setPages(prev => prev.map((p, i) => 
        i === index ? { ...p, loaded: true, width: img.naturalWidth, height: img.naturalHeight } : p
      ))
      setPreloadedPages(prev => new Set([...prev, index]))
    }
    img.onerror = () => {
      setPages(prev => prev.map((p, i) => 
        i === index ? { ...p, error: true } : p
      ))
    }
    img.src = page.url
  }, [pages, preloadedPages])

  // Preload pages around current page
  useEffect(() => {
    if (pages.length === 0) return

    const preloadRange = settings.preloadPages
    const startIndex = Math.max(0, currentPage - 1 - preloadRange)
    const endIndex = Math.min(pages.length, currentPage - 1 + preloadRange + 1)

    for (let i = startIndex; i < endIndex; i++) {
      preloadPage(i)
    }
  }, [currentPage, pages.length, settings.preloadPages, preloadPage])

  const playFlipSound = () => {
    if (!settings.soundEnabled) return
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1)
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.1)
    } catch (error) {
      console.log('Audio context not available')
    }
  }

  const navigateToPage = (page: number) => {
    if (page < 1 || page > totalPages || isTransitioning) return
    
    setIsTransitioning(true)
    setCurrentPage(page)
    
    if (settings.soundEnabled) {
      playFlipSound()
    }
    
    router.replace(`/reader/${mangaId}/${page}?chapter=${chapterId}`, { scroll: false })
    
    setTimeout(() => setIsTransitioning(false), 300)
  }

  const nextPage = () => {
    if (settings.readingMode === 'double' && currentPage < totalPages) {
      if (currentPage === 1) {
        navigateToPage(2)
      } else {
        const nextPageNum = currentPage + 2
        if (nextPageNum <= totalPages) {
          navigateToPage(nextPageNum)
        } else if (currentPage < totalPages) {
          navigateToPage(totalPages)
        } else {
          nextChapter()
        }
      }
    } else {
      if (currentPage < totalPages) {
        navigateToPage(currentPage + 1)
      } else {
        nextChapter()
      }
    }
  }

  const prevPage = () => {
    if (settings.readingMode === 'double' && currentPage > 1) {
      if (currentPage === totalPages && totalPages % 2 === 0) {
        navigateToPage(currentPage - 1)
      } else {
        const prevPageNum = currentPage - 2
        if (prevPageNum >= 1) {
          navigateToPage(prevPageNum)
        } else {
          navigateToPage(1)
        }
      }
    } else {
      if (currentPage > 1) {
        navigateToPage(currentPage - 1)
      } else {
        prevChapter()
      }
    }
  }

  const nextChapter = () => {
    if (currentChapterIndex < allChapters.length - 1) {
      const nextChapter = allChapters[currentChapterIndex + 1]
      router.push(`/reader/${mangaId}/1?chapter=${nextChapter.id}`)
    }
  }

  const prevChapter = () => {
    if (currentChapterIndex > 0) {
      const prevChapter = allChapters[currentChapterIndex - 1]
      router.push(`/reader/${mangaId}/1?chapter=${prevChapter.id}`)
    }
  }

  const handleTap = (x: number, y: number, width: number) => {
    if (x < width * 0.3) {
      settings.flipDirection === 'rtl' ? nextPage() : prevPage()
    } else if (x > width * 0.7) {
      settings.flipDirection === 'rtl' ? prevPage() : nextPage()
    } else {
      setSettings(prev => ({ ...prev, showUI: !prev.showUI }))
    }
  }

  const handleSwipeLeft = () => {
    settings.flipDirection === 'rtl' ? prevPage() : nextPage()
  }

  const handleSwipeRight = () => {
    settings.flipDirection === 'rtl' ? nextPage() : prevPage()
  }

  const handlePageLoad = (index: number, dimensions: { width: number; height: number }) => {
    setPages(prev => prev.map((p, i) => 
      i === index ? { ...p, loaded: true, ...dimensions } : p
    ))
    setPreloadedPages(prev => new Set([...prev, index]))
  }

  const handlePageError = (index: number) => {
    setPages(prev => prev.map((p, i) => 
      i === index ? { ...p, error: true } : p
    ))
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return

      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault()
          settings.flipDirection === 'rtl' ? nextPage() : prevPage()
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault()
          settings.flipDirection === 'rtl' ? prevPage() : nextPage()
          break
        case 'ArrowUp':
          e.preventDefault()
          if (settings.readingMode === 'scroll-vertical') {
            scrollContainerRef.current?.scrollBy(0, -200)
          } else {
            prevPage()
          }
          break
        case 'ArrowDown':
          e.preventDefault()
          if (settings.readingMode === 'scroll-vertical') {
            scrollContainerRef.current?.scrollBy(0, 200)
          } else {
            nextPage()
          }
          break
        case 'f':
        case 'F':
          e.preventDefault()
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
            setSettings(prev => ({ ...prev, fullscreen: true }))
          } else {
            document.exitFullscreen()
            setSettings(prev => ({ ...prev, fullscreen: false }))
          }
          break
        case 'h':
        case 'H':
          e.preventDefault()
          setSettings(prev => ({ ...prev, showUI: !prev.showUI }))
          break
        case 's':
        case 'S':
          e.preventDefault()
          setShowSettings(!showSettings)
          break
        case ' ':
          e.preventDefault()
          setSettings(prev => ({ ...prev, autoPlay: !prev.autoPlay }))
          break
        case 'Escape':
          setShowSettings(false)
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [settings, showSettings])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-full max-w-4xl mx-auto p-4">
          <div className="aspect-[3/4] bg-gray-800 rounded-lg overflow-hidden shadow-xl animate-pulse">
            <div className="h-full flex flex-col p-4 gap-4">
              <div className="flex gap-4 justify-center">
                <div className="h-20 w-1/4 rounded bg-gray-700"></div>
                <div className="h-20 w-1/4 rounded bg-gray-700"></div>
              </div>
              <div className="flex-1 relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-1/2 h-full relative">
                    <div className="absolute inset-0 bg-gray-700" style={{
                      clipPath: 'polygon(0% 100%, 100% 100%, 0% 0%)',
                      right: '0.5rem',
                      borderRadius: '0.5rem'
                    }}></div>
                    <div className="absolute inset-0 bg-gray-700" style={{
                      clipPath: 'polygon(100% 0%, 100% 100%, 0% 0%)',
                      left: '0.5rem',
                      borderRadius: '0.5rem'
                    }}></div>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 justify-center">
                <div className="h-20 w-1/4 rounded bg-gray-700"></div>
                <div className="h-20 w-1/4 rounded bg-gray-700"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderSingleMode = () => (
    <GestureHandler
      onSwipeLeft={handleSwipeLeft}
      onSwipeRight={handleSwipeRight}
      onTap={handleTap}
      className="w-full h-screen"
    >
      <div className="relative w-full h-screen flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, x: settings.flipDirection === 'rtl' ? 100 : -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: settings.flipDirection === 'rtl' ? -100 : 100 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="absolute inset-0"
          >
            <PageLoader
              page={pages[currentPage - 1] || { url: '', loaded: false, error: false }}
              onLoad={(dimensions) => handlePageLoad(currentPage - 1, dimensions)}
              onError={() => handlePageError(currentPage - 1)}
              className="w-full h-full"
              priority
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </GestureHandler>
  )

  const renderDoubleMode = () => (
    <GestureHandler
      onSwipeLeft={handleSwipeLeft}
      onSwipeRight={handleSwipeRight}
      onTap={handleTap}
      className="w-full h-screen"
    >
      <FlipBook
        pages={pages}
        currentPage={currentPage - 1}
        onPageChange={(page) => navigateToPage(page + 1)}
        onPageLoad={handlePageLoad}
        onPageError={handlePageError}
        className="w-full h-full"
      />
    </GestureHandler>
  )

  const renderWebtoonMode = () => (
    <div 
      ref={scrollContainerRef}
      className="w-full h-screen overflow-x-auto overflow-y-hidden"
      style={{ scrollBehavior: 'smooth' }}
    >
      <div className="flex h-full" style={{ width: `${pages.length * 100}vw` }}>
        {pages.map((page, index) => (
          <div key={index} className="w-screen h-full flex-shrink-0">
            <PageLoader
              page={page}
              onLoad={(dimensions) => handlePageLoad(index, dimensions)}
              onError={() => handlePageError(index)}
              className="w-full h-full"
              priority={Math.abs(index - (currentPage - 1)) <= 1}
            />
          </div>
        ))}
      </div>
    </div>
  )

  const renderScrollVerticalMode = () => (
    <div 
      ref={scrollContainerRef}
      className="w-full h-screen overflow-y-auto overflow-x-hidden"
    >
      <div className="space-y-4 p-4">
        {pages.map((page, index) => (
          <div key={index} className="w-full max-w-4xl mx-auto">
            <PageLoader
              page={page}
              onLoad={(dimensions) => handlePageLoad(index, dimensions)}
              onError={() => handlePageError(index)}
              className="w-full aspect-[3/4]"
              priority={Math.abs(index - (currentPage - 1)) <= 2}
            />
          </div>
        ))}
      </div>
    </div>
  )

  const renderContent = () => {
    switch (settings.readingMode) {
      case 'double':
        return renderDoubleMode()
      case 'webtoon':
      case 'scroll-horizontal':
        return renderWebtoonMode()
      case 'scroll-vertical':
        return renderScrollVerticalMode()
      default:
        return renderSingleMode()
    }
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Top Navigation Bar */}
      <AnimatePresence>
        {settings.showUI && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push(`/manga/${mangaId}`)}
                  className="text-white hover:bg-white/20"
                >
                  <Home className="w-5 h-5" />
                </Button>
                
                <div className="text-sm">
                  <div className="font-semibold">
                    {chapterInfo?.attributes?.title || `Chapter ${chapterInfo?.attributes?.chapter || '?'}`}
                  </div>
                  <div className="text-gray-400">
                    Page {currentPage} of {totalPages}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-white/20">
                  {settings.readingMode.toUpperCase()}
                </Badge>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSettings(!showSettings)}
                  className="text-white hover:bg-white/20"
                >
                  <Settings className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Reader Area */}
      <div ref={containerRef} className="relative w-full h-screen">
        {renderContent()}
      </div>

      {/* Bottom Navigation */}
      <AnimatePresence>
        {settings.showUI && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black/80 to-transparent p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={prevChapter}
                  disabled={currentChapterIndex === 0}
                  className="text-white hover:bg-white/20 disabled:opacity-50"
                >
                  <SkipBack className="w-5 h-5" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={prevPage}
                  disabled={currentPage === 1 && currentChapterIndex === 0}
                  className="text-white hover:bg-white/20 disabled:opacity-50"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-sm text-gray-400">
                    {currentPage} / {totalPages}
                  </div>
                  <div className="w-32 h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-500 transition-all duration-300"
                      style={{ width: `${(currentPage / totalPages) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={nextPage}
                  disabled={currentPage === totalPages && currentChapterIndex === allChapters.length - 1}
                  className="text-white hover:bg-white/20 disabled:opacity-50"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={nextChapter}
                  disabled={currentChapterIndex === allChapters.length - 1}
                  className="text-white hover:bg-white/20 disabled:opacity-50"
                >
                  <SkipForward className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <Card className="bg-gray-900 border-gray-700 p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white">Reader Settings</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSettings(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="space-y-6">
                  {/* Reading Mode */}
                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-3 block">
                      Reading Mode
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'single', label: 'Single', icon: Smartphone },
                        { value: 'double', label: 'Double', icon: Monitor },
                        { value: 'webtoon', label: 'Webtoon', icon: ScrollText },
                        { value: 'scroll-vertical', label: 'Scroll V', icon: FlipVertical }
                      ].map((mode) => {
                        const Icon = mode.icon
                        return (
                          <Button
                            key={mode.value}
                            variant={settings.readingMode === mode.value ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSettings(prev => ({ ...prev, readingMode: mode.value as any }))}
                            className="flex flex-col gap-1 h-auto py-2"
                          >
                            <Icon className="w-4 h-4" />
                            <span className="text-xs">{mode.label}</span>
                          </Button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Reading Direction */}
                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-2 block">
                      Reading Direction
                    </label>
                    <div className="flex gap-2">
                      <Button
                        variant={settings.flipDirection === 'rtl' ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSettings(prev => ({ ...prev, flipDirection: 'rtl' }))}
                        className="flex-1"
                      >
                        Right to Left
                      </Button>
                      <Button
                        variant={settings.flipDirection === 'ltr' ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSettings(prev => ({ ...prev, flipDirection: 'ltr' }))}
                        className="flex-1"
                      >
                        Left to Right
                      </Button>
                    </div>
                  </div>

                  {/* Preload Pages */}
                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-3 block">
                      Preload Pages: {settings.preloadPages}
                    </label>
                    <Slider
                      value={[settings.preloadPages]}
                      onValueChange={(value) => setSettings(prev => ({ ...prev, preloadPages: value[0] }))}
                      min={1}
                      max={5}
                      step={1}
                      className="w-full"
                    />
                  </div>

                  {/* Other Settings */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-300">Sound Effects</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSettings(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
                        className="text-gray-400 hover:text-white"
                      >
                        {settings.soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-700">
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>• Use arrow keys or A/D to navigate</div>
                    <div>• Press F for fullscreen</div>
                    <div>• Press H to hide/show UI</div>
                    <div>• Tap sides to navigate, center to toggle UI</div>
                    <div>• Swipe to navigate pages</div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center"
          >
            <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}