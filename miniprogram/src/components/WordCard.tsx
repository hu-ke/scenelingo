import React, { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'

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

  const handleToggle = () => {
    setExpanded((prev) => !prev)
  }

  const handleSpeak = (e: any) => {
    e.stopPropagation()
    try {
      const audioCtx = Taro.createInnerAudioContext()
      const ttsLang = 'en-US'
      audioCtx.src = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(name)}&tl=${ttsLang}&client=tw-ob`
      audioCtx.play()
      audioCtx.onEnded(() => audioCtx.destroy())
      audioCtx.onError(() => audioCtx.destroy())
    } catch {}
  }

  return (
    <View
      onClick={handleToggle}
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '8rpx',
        border: '1rpx solid #e8e8e8',
        padding: '12rpx 16rpx',
        width: '220rpx',
        boxShadow: '0 1rpx 6rpx rgba(0, 0, 0, 0.05)',
      }}
    >
      <View
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={{
            fontSize: '24rpx',
            fontWeight: '600',
            color: '#1a1a1a',
          }}
        >
          {name}
        </Text>

        <View
          onClick={handleSpeak}
          style={{
            fontSize: '22rpx',
          }}
        >
          🔊
        </View>
      </View>

      {chinese && (
        <Text
          style={{
            display: 'block',
            fontSize: '20rpx',
            color: '#e8642e',
            marginTop: '4rpx',
          }}
        >
          {chinese}
        </Text>
      )}

      {phonetic && (
        <Text
          style={{
            display: 'block',
            fontSize: '18rpx',
            color: '#999',
            marginTop: '2rpx',
          }}
        >
          {phonetic}
        </Text>
      )}

      {examples && examples.length > 0 && (
        <View
          style={{
            marginTop: '6rpx',
            fontSize: '18rpx',
            color: '#bbb',
          }}
        >
          <Text>{expanded ? '收起例句 ▲' : '展开例句 ▼'}</Text>
        </View>
      )}

      {expanded && examples && examples.length > 0 && (
        <View
          style={{
            marginTop: '10rpx',
            padding: '8rpx 12rpx',
            backgroundColor: '#f9f9fb',
            borderRadius: '8rpx',
          }}
        >
          {examples.map((example, index) => (
            <View
              key={index}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6rpx',
                padding: '6rpx 0',
                borderBottom:
                  index < examples.length - 1 ? '1rpx solid #eee' : 'none',
              }}
            >
              <Text style={{ fontSize: '18rpx', flexShrink: 0 }}>📖</Text>
              <Text
                style={{
                  fontSize: '18rpx',
                  color: '#444',
                  lineHeight: '1.5',
                }}
              >
                {example}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

export default WordCard
