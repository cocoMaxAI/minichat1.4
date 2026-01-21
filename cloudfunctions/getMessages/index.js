// F:\minichat1.4\cloudfunctions\getMessages\index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function isCloudUrl(url) {
  return url && typeof url === 'string' && url.startsWith('cloud://')
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { chatId, lastMessageTime, pageSize = 20 } = event

  if (!openid) {
    return { success: false, error: '获取用户身份失败' }
  }

  if (!chatId) {
    return { success: false, error: '缺少会话ID' }
  }

  try {
    // 验证会话权限
    let chatData
    try {
      const chatRes = await db.collection('chats').doc(chatId).get()
      chatData = chatRes.data
    } catch (err) {
      console.error('会话不存在:', chatId)
      return { success: false, error: '会话不存在' }
    }

    if (!chatData) {
      return { success: false, error: '会话不存在' }
    }

    const members = Array.isArray(chatData.members) ? chatData.members : []
    if (!members.includes(openid)) {
      return { success: false, error: '无权访问此会话' }
    }

    // 获取消息
    let query = db.collection('messages').where({ chatId })
    
    if (lastMessageTime) {
      query = db.collection('messages').where({
        chatId,
        createTime: _.lt(new Date(lastMessageTime))
      })
    }

    const msgRes = await query
      .orderBy('createTime', 'desc')
      .limit(pageSize)
      .get()

    let messages = (msgRes.data || []).reverse()

    // ========== 【核心修改】从 users 集合获取发送者的最新信息 ==========
    const senderIds = [...new Set(messages.map(msg => msg.senderId).filter(Boolean))]
    const senderInfoMap = {}
    
    if (senderIds.length > 0) {
      try {
        const usersRes = await db.collection('users')
          .where({
            _id: _.in(senderIds)
          })
          .get()
        
        usersRes.data.forEach(user => {
          senderInfoMap[user._id] = {
            nickName: user.nickName || '用户',
            avatarUrl: user.avatarUrl || ''  // 这里获取的是 users 表中最新的头像URL
          }
        })
        console.log('获取到发送者信息:', Object.keys(senderInfoMap).length, '个用户')
      } catch (err) {
        console.warn('获取发送者信息失败:', err)
      }
    }

    // 使用最新的发送者信息替换消息中的旧信息
    messages = messages.map(msg => {
      if (senderInfoMap[msg.senderId]) {
        return {
          ...msg,
          senderInfo: senderInfoMap[msg.senderId]
        }
      }
      return msg
    })
    // ========== 核心修改结束 ==========

    // 收集需要转换的云存储URL
    const cloudUrls = new Set()
    
    messages.forEach(msg => {
      if (msg.recalled) return

      // 图片消息的内容
      if (msg.type === 'image' && isCloudUrl(msg.content)) {
        cloudUrls.add(msg.content)
      }
      // 发送者头像
      const avatarUrl = msg.senderInfo?.avatarUrl
      if (isCloudUrl(avatarUrl)) {
        cloudUrls.add(avatarUrl)
      }
    })

    console.log('需要转换的云存储URL数量:', cloudUrls.size)

    // 批量转换云存储URL为临时URL
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
            console.warn('转换URL失败:', item.fileID, item.errMsg)
          }
        })
        console.log('成功转换URL数量:', Object.keys(urlMap).length)
      } catch (err) {
        console.error('转换临时URL失败:', err)
      }
    }

    // 处理消息中的URL
    const processedMessages = messages.map(msg => {
      if (msg.recalled) return msg
      
      const newMsg = { ...msg }
      
      // 处理图片消息内容
      if (msg.type === 'image' && msg.content) {
        if (urlMap[msg.content]) {
          newMsg.originalCloudUrl = msg.content
          newMsg.content = urlMap[msg.content]
        } else if (isCloudUrl(msg.content)) {
          newMsg.originalCloudUrl = msg.content
          newMsg.loadError = true
        }
      }
      
      // 处理发送者头像URL
      if (msg.senderInfo && msg.senderInfo.avatarUrl) {
        const avatarUrl = msg.senderInfo.avatarUrl
        
        if (urlMap[avatarUrl]) {
          // 云存储URL已成功转换为临时URL
          newMsg.senderInfo = {
            ...msg.senderInfo,
            avatarUrl: urlMap[avatarUrl]
          }
        } else if (isCloudUrl(avatarUrl)) {
          // 云存储URL转换失败，设为空让前端使用默认头像
          console.warn('头像URL转换失败，将使用默认头像:', avatarUrl)
          newMsg.senderInfo = {
            ...msg.senderInfo,
            avatarUrl: ''
          }
        }
        // https:// 开头的URL保持不变
      }
      
      return newMsg
    })

    // 更新未读数
    try {
      await db.collection('chats').doc(chatId).update({
        data: {
          [`unreadCount.${openid}`]: 0
        }
      })
    } catch (e) {
      console.warn('更新未读数失败:', e)
    }

    return {
      success: true,
      data: processedMessages,
      hasMore: messages.length === pageSize
    }
  } catch (err) {
    console.error('getMessages 错误:', err)
    return {
      success: false,
      error: err.message || '获取消息失败'
    }
  }
}