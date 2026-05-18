import React, { useEffect, useState } from 'react'
import { View } from '@tarojs/components'
import { useReview } from '../context/AppContext'
import { getThemeColors } from '../utils/theme'

interface AppLogoProps {
  size?: number
  animated?: boolean
}

const AppLogo: React.FC<AppLogoProps> = ({ size = 56, animated = false }) => {
  const { state } = useReview()
  const [scale, setScale] = useState(1)
  const colors = getThemeColors(state.theme)

  useEffect(() => {
    if (!animated) return
    const interval = setInterval(() => {
      setScale((prev) => (prev === 1 ? 1.12 : 1))
    }, 1200)
    return () => clearInterval(interval)
  }, [animated])

  const startColor = colors?.['color-primary-start'] || '#667eea'
  const endColor = colors?.['color-primary-end'] || '#764ba2'

  return (
    <View
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${size * 0.3}px`,
        background: `linear-gradient(135deg, ${startColor}, ${endColor})`,
        fontSize: `${size * 0.55}px`,
        lineHeight: `${size}px`,
        textAlign: 'center',
        transition: 'transform 0.8s ease-in-out',
        transform: `scale(${scale})`,
        boxShadow: `0 4px 15px ${startColor}40`,
      }}
    >
      <View style={{ transform: 'rotate(-5deg)' }}>🔍</View>
    </View>
  )
}

export default AppLogo
