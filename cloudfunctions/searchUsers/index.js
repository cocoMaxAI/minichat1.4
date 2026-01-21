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

  const cloudUrls = []
  users.forEach(user => {
    if (isCloudUrl(user.avatarUrl)) {
      cloudUrls.push(user.avatarUrl)
    }
  })

  if (cloudUrls.length === 0) return users

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

    return users.map(user => {
      if (isCloudUrl(user.avatarUrl)) {
        return {
          ...user,
          avatarUrl: urlMap[user.avatarUrl] || ''
        }
      }
      return user
    })
  } catch (err) {
    console.error('转换头像URL失败:', err)
    return users.map(user => {
      if (isCloudUrl(user.avatarUrl)) {
        return { ...user, avatarUrl: '' }
      }
      return user
    })
  }
}

exports.main = async (event, context) => {
  console.log('searchUsers 被调用, event:', JSON.stringify(event))
  
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { keyword } = event

  console.log('openid:', openid, 'keyword:', keyword)

  if (!openid) {
    return { success: false, error: '获取用户身份失败' }
  }

  if (!keyword || keyword.trim().length < 1) {
    return { success: false, error: '请输入搜索关键词' }
  }

  try {
    console.log('开始查询 users 集合...')
    
    const userRes = await db.collection('users')
      .where(_.or([
        { nickName: db.RegExp({ regexp: keyword.trim(), options: 'i' }) },
        { _id: keyword.trim() }
      ]))
      .field({ _id: true, nickName: true, avatarUrl: true })
      .limit(20)
      .get()

    console.log('查询结果数量:', userRes.data?.length || 0)

    // 排除自己
    let users = (userRes.data || []).filter(u => u._id !== openid)

    // 【关键修复】转换云存储URL为临时URL
    users = await convertCloudUrls(users)

    if (users.length > 0) {
      const userIds = users.map(u => u._id)
      
      const friendRes = await db.collection('friends')
        .where(_.or([
          { userId1: openid, userId2: _.in(userIds) },
          { userId1: _.in(userIds), userId2: openid }
        ]))
        .get()

      const relationMap = {}
      friendRes.data.forEach(f => {
        const otherId = f.userId1 === openid ? f.userId2 : f.userId1
        relationMap[otherId] = {
          status: f.status,
          isRequester: f.requesterId === openid
        }
      })

      users.forEach(u => {
        const relation = relationMap[u._id]
        if (relation) {
          u.friendStatus = relation.status
          u.isRequester = relation.isRequester
        } else {
          u.friendStatus = 'none'
        }
      })
    }

    return {
      success: true,
      data: users
    }
  } catch (err) {
    console.error('searchUsers 查询错误:', err.message, err.stack)
    return { 
      success: false, 
      error: err.message || '搜索失败',
      errorDetail: err.toString()  
    }
  }
}