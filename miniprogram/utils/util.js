/**
 * 防抖函数
 */
function debounce(fn, delay = 300) {
    let timer = null
    return function (...args) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        fn.apply(this, args)
      }, delay)
    }
  }
  
  /**
   * 节流函数
   */
  function throttle(fn, interval = 300) {
    let lastTime = 0
    return function (...args) {
      const now = Date.now()
      if (now - lastTime >= interval) {
        lastTime = now
        fn.apply(this, args)
      }
    }
  }
  
  /**
   * 格式化时间
   */
  function formatTime(date) {
    if (!date) return ''
    if (typeof date === 'string') {
      date = new Date(date)
    }
    
    const now = new Date()
    const diff = now - date
    const oneMinute = 60 * 1000
    const oneHour = 60 * oneMinute
    const oneDay = 24 * oneHour
  
    if (diff < oneMinute) {
      return '刚刚'
    } else if (diff < oneHour) {
      return Math.floor(diff / oneMinute) + '分钟前'
    } else if (diff < oneDay && date.getDate() === now.getDate()) {
      return padZero(date.getHours()) + ':' + padZero(date.getMinutes())
    } else if (diff < 2 * oneDay) {
      return '昨天 ' + padZero(date.getHours()) + ':' + padZero(date.getMinutes())
    } else {
      return (date.getMonth() + 1) + '月' + date.getDate() + '日'
    }
  }
  
  function padZero(num) {
    return num < 10 ? '0' + num : num
  }
  
  const imageCompressConfig = {
    maxWidth: 1080,
    maxHeight: 1920,
    quality: 0.8
  }
  
  module.exports = {
    debounce,
    throttle,
    formatTime,
    imageCompressConfig
  }