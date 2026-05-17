import React, { useEffect, useState } from 'react'
import { View } from '@tarojs/components'

interface AppLogoProps {
  size?: number
  animated?: boolean
}

const AppLogo: React.FC<AppLogoProps> = ({ size = 56, animated = false }) => {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    if (!animated) return

    const interval = setInterval(() => {
      setScale((prev) => (prev === 1 ? 1.12 : 1))
    }, 1200)

    return () => clearInterval(interval)
  }, [animated])

  const gradientColors = ['#667eea', '#764ba2']

  return (
    <View
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${size * 0.3}px`,
        background: `linear-gradient(135deg, ${gradientColors[0]}, ${gradientColors[1]})`,
        fontSize: `${size * 0.55}px`,
        lineHeight: `${size}px`,
        textAlign: 'center',
        transition: 'transform 0.8s ease-in-out',
        transform: `scale(${scale})`,
        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
      }}
    >
      <View style={{ transform: 'rotate(-5deg)' }}>🔍</View>
    </View>
  )
}

export default AppLogo