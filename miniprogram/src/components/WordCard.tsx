import React, { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getApiBaseUrl } from '../utils/api'
import { getTtsLang, getLanguagePrefs } from '../utils/languagePrefs'

interface WordObj {
  name: string
  chinese?: string
  phonetic?: string
  examples?: string[]
}

interface WordCardProps {
  obj: WordObj
}

const WordCard: React.FC<WordCardProps> = ({ obj }) => {
  const [expanded, setExpanded] = useState(false)
  const { name, chinese, phonetic, examples } = obj

  const handleToggle = () => setExpanded((prev) => !prev)

  const handleSpeak = (e: any) => {
    e.stopPropagation()
    try {
      const audioCtx = Taro.createInnerAudioContext()
      const ttsLang = getTtsLang(getLanguagePrefs().targetLang)
      const baseUrl = getApiBaseUrl()
      audioCtx.src = `${baseUrl}/api/tts?text=${encodeURIComponent(name)}&lang=${ttsLang}`
      audioCtx.play()
      audioCtx.onEnded(() => audioCtx.destroy())
      audioCtx.onError(() => audioCtx.destroy())
    } catch {}
  }

  return (
    <View
      onClick={handleToggle}
      style={{
        background: '#fff',
        borderRadius: '10rpx',
        padding: '14rpx 20rpx',
        boxShadow: '0 1rpx 6rpx rgba(0,0,0,0.05)',
        textAlign: 'center',
        minWidth: '150rpx',
      }}
    >
      <Text style={{ fontWeight: 700, fontSize: '28rpx', color: '#333' }}>
        {name}
      </Text>
      {chinese && (
        <Text style={{ display: 'block', fontSize: '24rpx', color: '#667eea', fontWeight: 500, marginTop: '2rpx' }}>
          {chinese}
        </Text>
      )}
      <Text style={{ display: 'block', fontSize: '22rpx', color: '#888', marginTop: '2rpx' }}>
        {phonetic || ''}
      </Text>
      <View
        onClick={handleSpeak}
        style={{
          background: 'none',
          border: 'none',
          fontSize: '24rpx',
          padding: '4rpx',
          marginTop: '6rpx',
        }}
      >
        🔊
      </View>
      {expanded && examples && examples.length > 0 && (
        <View style={{
          marginTop: '10rpx',
          paddingTop: '10rpx',
          borderTop: '1rpx solid #eee',
          textAlign: 'left',
          fontSize: '22rpx',
          color: '#666',
        }}>
          {examples.map((ex, i) => (
            <View key={i} style={{ marginBottom: '6rpx', display: 'flex', alignItems: 'flex-start', gap: '6rpx' }}>
              <Text style={{ flexShrink: 0 }}>📖</Text>
              <Text style={{ lineHeight: 1.5 }}>{ex}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

export default WordCard
