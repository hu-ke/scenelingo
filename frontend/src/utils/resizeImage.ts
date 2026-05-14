export function resizeImage(file: File, maxSize: number = 1500): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight))
      if (scale >= 1) {
        resolve(new Blob([file], { type: file.type }))
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.naturalWidth * scale)
      canvas.height = Math.round(img.naturalHeight * scale)

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas context not available'))
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('toBlob failed'))
          }
        },
        'image/jpeg',
        0.85,
      )
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}
