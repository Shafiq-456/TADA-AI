import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'

export function TiltContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [rotateX, setRotateX] = useState(0)
  const [rotateY, setRotateY] = useState(0)
  const [glareX, setGlareX] = useState(50)
  const [glareY, setGlareY] = useState(50)
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    const mouseX = e.clientX - rect.left - width / 2
    const mouseY = e.clientY - rect.top - height / 2

    // Max 10 degrees tilt
    const rX = -(mouseY / (height / 2)) * 10
    const rY = (mouseX / (width / 2)) * 10

    setRotateX(rX)
    setRotateY(rY)

    // Glare position (percentage from 0 to 100)
    const gX = ((e.clientX - rect.left) / width) * 100
    const gY = ((e.clientY - rect.top) / height) * 100
    setGlareX(gX)
    setGlareY(gY)
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    setRotateX(0)
    setRotateY(0)
    setIsHovered(false)
  }

  return (
    <motion.div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ rotateX, rotateY }}
      transition={{ type: 'spring', damping: 25, stiffness: 200, mass: 0.5 }}
      style={{ transformStyle: 'preserve-3d', perspective: 1000 }}
      className={`relative ${className || ''}`}
    >
      {/* Glare spotlight layer */}
      <div
        className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-300 rounded-[inherit]"
        style={{
          background: `radial-gradient(circle 200px at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.06), transparent)`,
          opacity: isHovered ? 1 : 0,
        }}
      />
      {children}
    </motion.div>
  )
}
