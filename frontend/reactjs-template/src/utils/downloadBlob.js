const downloadBlob = (blobData, filename) => {
  const blob = blobData instanceof Blob ? blobData : new Blob([blobData])
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0)
}

export const getDownloadFilename = (contentDisposition, fallback) => {
  if (typeof contentDisposition !== 'string') return fallback

  const encoded = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1]).replace(/[\\/:*?"<>|]/g, '-')
    } catch (error) {
      return fallback
    }
  }

  const plain = contentDisposition.match(/filename="?([^";]+)"?/i)
  return plain?.[1]
    ? plain[1].replace(/[\\/:*?"<>|]/g, '-')
    : fallback
}

export const getBlobErrorMessage = async (error, fallback) => {
  const data = error?.response?.data || error?.data
  if (data instanceof Blob) {
    try {
      const text = await data.text()
      const payload = JSON.parse(text)
      if (typeof payload?.message === 'string' && payload.message.trim()) {
        return payload.message
      }
    } catch (parseError) {
      // Binary and malformed error bodies intentionally use the safe fallback.
    }
  }
  if (typeof data?.message === 'string' && data.message.trim()) return data.message
  return fallback
}

export default downloadBlob
