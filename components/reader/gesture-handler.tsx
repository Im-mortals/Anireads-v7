'use client'

import { useRef, useEffect } from 'react'
import { useGesture } from 'react-use-gesture'
import { useSpring, animated } from 'react-spring'

interface GestureHandlerProps {
  children: React.ReactNode
  onSwipeLeft: () => void
  onSwipeRight: () => void
  onTap: (x: number, y: number, width: number) => void
  disabled?: boolean
  className?: string
}

export default function GestureHandler({
  children,
  onSwipeLeft,
  onSwipeRight,
  onTap,
  disabled = false,
  className = ''
}: GestureHandlerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [{ x, scale }, api] = useSpring(() => ({
    x: 0,
    scale: 1,
    config: { tension: 300, friction: 30 }
  }))

  const bind = useGesture(
    {
      onDrag: ({ down, movement: [mx], direction: [xDir], velocity, cancel }) => {
        if (disabled) return
        
        const trigger = Math.abs(mx) > 100 || Math.abs(velocity) > 0.5
        
        if (trigger && !down) {
          if (xDir > 0) {
            onSwipeRight()
          } else {
            onSwipeLeft()
          }
          cancel()
        }
        
        api.start({
          x: down ? mx : 0,
          scale: down ? 0.98 : 1,
          immediate: down
        })
      },
      onClick: ({ event }) => {
        if (disabled) return
        
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return
        
        const x = event.clientX - rect.left
        const y = event.clientY - rect.top
        
        onTap(x, y, rect.width)
      },
      onPinch: ({ offset: [scale], origin: [ox, oy] }) => {
        if (disabled) return
        
        api.start({
          scale: Math.max(0.5, Math.min(3, scale)),
          transformOrigin: `${ox}px ${oy}px`
        })
      }
    },
    {
      drag: {
        axis: 'x',
        threshold: 10,
        rubberband: true
      },
      pinch: {
        scaleBounds: { min: 0.5, max: 3 },
        rubberband: true
      }
    }
  )

  return (
    <animated.div
      ref={containerRef}
      {...bind()}
      className={`touch-none select-none ${className}`}
      style={{
        x,
        scale,
        cursor: disabled ? 'default' : 'grab'
      }}
    >
      {children}
    </animated.div>
  )
}