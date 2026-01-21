const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { chatId, content, type = 'text', duration } = event

  if (!openid) {
    return { success: false, error: '获取用户身份失败' }
  }
  if (!chatId) {
    return { success: false, error: '缺少会话ID' }
  }
  if (!content && content !== '') {
    return { success: false, error: '消息内容不能为空' }
  }

  try {
    // 1. 获取会话信息
    let chatData
    try {
      const chatRes = await db.collection('chats').doc(chatId).get()
      chatData = chatRes.data
    } catch (e) {
      return { success: false, error: '会话不存在' }
    }

    if (!chatData) {
      return { success: false, error: '会话不存在' }
    }

    const members = Array.isArray(chatData.members) ? chatData.members : []
    if (!members.includes(openid)) {
      return { success: false, error: '无权发送消息' }
    }

    // 2. ★★★ 关键新增：私聊时检查好友关系 ★★★
    if (members.length === 2) {
      const otherUserId = members.find(id => id !== openid)
      
      if (otherUserId) {
        // 使用 or 查询两种可能的组合，与 deleteFriend 保持一致
        const friendRes = await db.collection('friends')
          .where(_.and([
            _.or([
              { userId1: openid, userId2: otherUserId },
              { userId1: otherUserId, userId2: openid }
            ]),
            { status: 'accepted' }
          ]))
          .limit(1)
          .get()

        if (!friendRes.data || friendRes.data.length === 0) {
          return { 
            success: false, 
            error: '对方不是你的好友，无法发送消息',
            code: 'NOT_FRIEND'  // 返回错误码，便于前端处理
          }
        }
      }
    }
    // ★★★ 好友关系检查结束 ★★★

    // 3. 获取发送者信息
    let senderInfo = { nickName: '用户', avatarUrl: '' }
    try {
      const userRes = await db.collection('users').doc(openid).get()
      if (userRes.data) {
        senderInfo = {
          nickName: userRes.data.nickName || '用户',
          avatarUrl: userRes.data.avatarUrl || ''
        }
      }
    } catch (e) {
      console.warn('获取用户信息失败，使用默认值')
    }

    // 4. 构建消息数据
    const messageData = {
      chatId,
      senderId: openid,
      senderInfo,
      type,
      content,
      createTime: db.serverDate(),
      status: 'sent'
    }

    // 如果是语音消息，添加时长字段
    if (type === 'voice' && duration) {
      messageData.duration = duration
    }

    const msgRes = await db.collection('messages').add({ data: messageData })

    // 5. 更新会话的最后消息
    const otherMembers = members.filter(id => id !== openid)
    
    let lastMessageContent = content
    if (type === 'image') {
      lastMessageContent = '[图片]'
    } else if (type === 'voice') {
      lastMessageContent = '[语音]'
    } else if (content.length > 50) {
      lastMessageContent = content.substring(0, 50) + '...'
    }
    
    const updateData = {
      lastMessage: {
        content: lastMessageContent,
        type: type,
        senderId: openid,
        time: db.serverDate()
      },
      updateTime: db.serverDate()
    }

    otherMembers.forEach(memberId => {
      updateData[`unreadCount.${memberId}`] = _.inc(1)
    })

    await db.collection('chats').doc(chatId).update({
      data: updateData
    })

    // 6. 转换云存储URL
    let returnContent = content
    let returnAvatarUrl = senderInfo.avatarUrl
    
    const urlsToConvert = []
    if ((type === 'image' || type === 'voice') && content.startsWith('cloud://')) {
      urlsToConvert.push(content)
    }
    if (senderInfo.avatarUrl && senderInfo.avatarUrl.startsWith('cloud://')) {
      urlsToConvert.push(senderInfo.avatarUrl)
    }
    
    if (urlsToConvert.length > 0) {
      try {
        const tempRes = await cloud.getTempFileURL({
          fileList: urlsToConvert
        })
        
        tempRes.fileList.forEach(item => {
          if (item.status === 0 && item.tempFileURL) {
            if (item.fileID === content) {
              returnContent = item.tempFileURL
            }
            if (item.fileID === senderInfo.avatarUrl) {
              returnAvatarUrl = item.tempFileURL
            }
          }
        })
      } catch (err) {
        console.error('转换临时URL失败:', err)
      }
    }

    // 7. 返回消息对象
    const returnMessage = {
      ...messageData,
      _id: msgRes._id,
      content: returnContent,
      senderInfo: {
        ...senderInfo,
        avatarUrl: returnAvatarUrl
      },
      createTime: new Date()
    }

    if (type === 'voice' && duration) {
      returnMessage.duration = duration
    }

    return {
      success: true,
      messageId: msgRes._id,
      message: returnMessage
    }
  } catch (err) {
    console.error('sendMessage 错误:', err)
    return {
      success: false,
      error: err.message || '发送消息失败'
    }
  }
}