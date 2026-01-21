const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 检查是否是云存储URL
function isCloudUrl(url) {
  return url && typeof url === 'string' && url.startsWith('cloud://')
}

// 转换单个用户信息中的头像URL
async function convertUserAvatars(userMap) {
  const cloudUrls = []
  const userIds = Object.keys(userMap)

  userIds.forEach(id => {
    if (isCloudUrl(userMap[id].avatarUrl)) {
      cloudUrls.push(userMap[id].avatarUrl)
    }
  })

  if (cloudUrls.length === 0) return userMap

  try {
    const tempRes = await cloud.getTempFileURL({
      fileList: [...new Set(cloudUrls)]
    })

    const urlMap = {}
    tempRes.fileList.forEach(item => {
      if (item.status === 0 && item.tempFileURL) {
        urlMap[item.fileID] = item.tempFileURL
      }
    })

    // 更新 userMap 中的头像URL
    userIds.forEach(id => {
      if (isCloudUrl(userMap[id].avatarUrl)) {
        userMap[id].avatarUrl = urlMap[userMap[id].avatarUrl] || ''
      }
    })
  } catch (err) {
    console.error('转换头像URL失败:', err)
    // 转换失败时设为空
    userIds.forEach(id => {
      if (isCloudUrl(userMap[id].avatarUrl)) {
        userMap[id].avatarUrl = ''
      }
    })
  }

  return userMap
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) {
    return { success: false, error: '获取用户身份失败' }
  }

  try {
    // 获取发给我的待处理请求
    const requestRes = await db.collection('friends')
      .where(_.and([
        _.or([
          { userId1: openid },
          { userId2: openid }
        ]),
        { status: 'pending' },
        { requesterId: _.neq(openid) }
      ]))
      .orderBy('createTime', 'desc')
      .limit(50)
      .get()

    const requests = requestRes.data || []

    if (requests.length > 0) {
      const requesterIds = requests.map(r => r.requesterId)
      const userRes = await db.collection('users')
        .where({ _id: _.in(requesterIds) })
        .field({ _id: true, nickName: true, avatarUrl: true })
        .get()

      let userMap = {}
      userRes.data.forEach(u => {
        userMap[u._id] = u
      })

      // 【关键修复】转换云存储URL为临时URL
      userMap = await convertUserAvatars(userMap)

      requests.forEach(r => {
        r.requesterInfo = userMap[r.requesterId] || { nickName: '未知用户', avatarUrl: '' }
      })
    }

    return {
      success: true,
      data: requests
    }
  } catch (err) {
    console.error('getFriendRequests 错误:', err)
    return { success: false, error: err.message || '获取请求列表失败' }
  }
}