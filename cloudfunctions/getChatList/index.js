// F:\minichat1.4\cloudfunctions\getChatList\index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function isCloudUrl(url) {
  return url && typeof url === 'string' && url.startsWith('cloud://')
}

function isValidAvatarUrl(url) {
  if (!url) return false
  if (url.startsWith('cloud://')) return true
  if (url.startsWith('https://')) return true
  return false
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { page = 0, pageSize = 20 } = event

  if (!openid) {
    return { success: false, error: '获取用户身份失败' }
  }

  try {
    const chatRes = await db.collection('chats')
      .where({
        members: _.elemMatch(_.eq(openid))
      })
      .orderBy('updateTime', 'desc')
      .skip(page * pageSize)
      .limit(pageSize)
      .get()

    if (!chatRes.data || chatRes.data.length === 0) {
      return { success: true, data: [], hasMore: false }
    }

    const userIds = new Set()
    chatRes.data.forEach(chat => {
      if (Array.isArray(chat.members)) {
        chat.members.forEach(id => {
          if (id && id !== openid) userIds.add(id)
        })
      }
    })

    const userInfoMap = {}
    if (userIds.size > 0) {
      const userIdsArray = [...userIds]
      const batchSize = 100
      for (let i = 0; i < userIdsArray.length; i += batchSize) {
        const batch = userIdsArray.slice(i, i + batchSize)
        const usersRes = await db.collection('users')
          .where({
            _id: _.in(batch)
          })
          .field({
            _id: true,
            nickName: true,
            avatarUrl: true
          })
          .get()
        
        usersRes.data.forEach(user => {
          userInfoMap[user._id] = {
            nickName: user.nickName || '用户',
            avatarUrl: isValidAvatarUrl(user.avatarUrl) ? user.avatarUrl : ''
          }
        })
      }
    }

    // 【关键新增】收集所有需要转换的 cloud:// URL
    const cloudUrls = new Set()
    
    // 收集用户头像中的 cloud:// URL
    Object.values(userInfoMap).forEach(info => {
      if (isCloudUrl(info.avatarUrl)) {
        cloudUrls.add(info.avatarUrl)
      }
    })
    
    // 收集聊天中缓存的头像和群头像
    chatRes.data.forEach(chat => {
      if (chat.memberInfo) {
        Object.values(chat.memberInfo).forEach(member => {
          if (isCloudUrl(member.avatarUrl)) {
            cloudUrls.add(member.avatarUrl)
          }
        })
      }
      if (isCloudUrl(chat.groupAvatar)) {
        cloudUrls.add(chat.groupAvatar)
      }
    })

    // 【关键新增】批量转换 cloud:// 为 https:// 临时链接
    const urlMap = {}
    if (cloudUrls.size > 0) {
      try {
        const tempRes = await cloud.getTempFileURL({
          fileList: [...cloudUrls]
        })
        
        tempRes.fileList.forEach(item => {
          if (item.status === 0 && item.tempFileURL) {
            urlMap[item.fileID] = item.tempFileURL
          } else {
            console.warn('头像URL转换失败:', item.fileID, item.errMsg)
          }
        })
      } catch (err) {
        console.error('批量转换临时URL失败:', err)
      }
    }

    const chatList = chatRes.data.map(chat => {
      const members = Array.isArray(chat.members) ? chat.members : []
      const otherUserId = members.find(id => id && id !== openid) || ''
      
      const otherUserInfo = userInfoMap[otherUserId] || {}
      
      let displayAvatar = otherUserInfo.avatarUrl || ''
      let displayName = otherUserInfo.nickName || ''
      
      if (!displayName && chat.memberInfo && chat.memberInfo[otherUserId]) {
        displayName = chat.memberInfo[otherUserId].nickName || '未知用户'
      }
      if (!displayAvatar && chat.memberInfo && chat.memberInfo[otherUserId]) {
        const cachedAvatar = chat.memberInfo[otherUserId].avatarUrl
        displayAvatar = isValidAvatarUrl(cachedAvatar) ? cachedAvatar : ''
      }
      
      // 【关键新增】将 cloud:// 转换为已获取的临时URL，转换失败则设为空
      if (isCloudUrl(displayAvatar)) {
        displayAvatar = urlMap[displayAvatar] || ''
      }

      let groupAvatarUrl = chat.groupAvatar || ''
      if (isCloudUrl(groupAvatarUrl)) {
        groupAvatarUrl = urlMap[groupAvatarUrl] || ''
      }
      
      return {
        _id: chat._id,
        type: chat.type || 'private',
        members: chat.members,
        lastMessage: chat.lastMessage || {},
        updateTime: chat.updateTime,
        displayName: chat.type === 'group' 
          ? (chat.groupName || '群聊') 
          : (displayName || '未知用户'),
        displayAvatar: chat.type === 'group' 
          ? groupAvatarUrl 
          : displayAvatar,
        unread: (chat.unreadCount && chat.unreadCount[openid]) || 0
      }
    })

    return {
      success: true,
      data: chatList,
      hasMore: chatRes.data.length === pageSize
    }
  } catch (err) {
    console.error('getChatList 错误:', err)
    return { success: false, error: err.message || '获取会话列表失败' }
  }
}