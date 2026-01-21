const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 检查是否是云存储URL
function isCloudUrl(url) {
  return url && typeof url === 'string' && url.startsWith('cloud://')
}

// 批量转换云存储URL为临时URL
async function convertCloudUrls(users) {
  if (!users || users.length === 0) return users

  // 收集所有需要转换的云存储URL
  const cloudUrls = []
  users.forEach(user => {
    if (isCloudUrl(user.avatarUrl)) {
      cloudUrls.push(user.avatarUrl)
    }
  })

  if (cloudUrls.length === 0) return users

  try {
    const tempRes = await cloud.getTempFileURL({
      fileList: [...new Set(cloudUrls)]  // 去重
    })

    // 构建URL映射
    const urlMap = {}
    tempRes.fileList.forEach(item => {
      if (item.status === 0 && item.tempFileURL) {
        urlMap[item.fileID] = item.tempFileURL
      }
    })

    // 替换用户头像URL
    return users.map(user => {
      if (isCloudUrl(user.avatarUrl)) {
        return {
          ...user,
          avatarUrl: urlMap[user.avatarUrl] || ''  // 转换失败则设为空
        }
      }
      return user
    })
  } catch (err) {
    console.error('转换头像URL失败:', err)
    // 转换失败时，将所有云存储URL设为空，让前端显示默认头像
    return users.map(user => {
      if (isCloudUrl(user.avatarUrl)) {
        return { ...user, avatarUrl: '' }
      }
      return user
    })
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) {
    return { success: false, error: '获取用户身份失败' }
  }

  try {
    // 获取所有已接受的好友关系
    const friendRes = await db.collection('friends')
      .where(_.and([
        _.or([
          { userId1: openid },
          { userId2: openid }
        ]),
        { status: 'accepted' }
      ]))
      .get()

    const friends = friendRes.data || []

    if (friends.length === 0) {
      return { success: true, data: [] }
    }

    // 提取好友ID
    const friendIds = friends.map(f => 
      f.userId1 === openid ? f.userId2 : f.userId1
    )

    const userRes = await db.collection('users')
      .where({ _id: _.in(friendIds) })
      .field({ _id: true, nickName: true, avatarUrl: true })
      .get()

    let users = userRes.data || []
    users = await convertCloudUrls(users)

    return {
      success: true,
      data: users
    }
  } catch (err) {
    console.error('getFriends 错误:', err)
    return { success: false, error: err.message || '获取好友列表失败' }
  }
}