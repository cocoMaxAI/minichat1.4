
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { fileList } = event
  
  if (!fileList || !Array.isArray(fileList) || fileList.length === 0) {
    return { success: true, urlMap: {} }
  }
  
  // 过滤出 cloud:// 开头的 URL
  const cloudUrls = fileList.filter(url => url && url.startsWith('cloud://'))
  
  if (cloudUrls.length === 0) {
    return { success: true, urlMap: {} }
  }
  
  try {
    const res = await cloud.getTempFileURL({
      fileList: cloudUrls
    })
    
    const urlMap = {}
    res.fileList.forEach(item => {
      if (item.status === 0 && item.tempFileURL) {
        urlMap[item.fileID] = item.tempFileURL
      }
    })
    
    return {
      success: true,
      urlMap
    }
  } catch (err) {
    console.error('转换URL失败:', err)
    return {
      success: false,
      error: err.message,
      urlMap: {}
    }
  }
}