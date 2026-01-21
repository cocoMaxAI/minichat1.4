// cloudfunctions/recallMessage/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { messageId, chatId } = event

  if (!openid) {
    return { success: false, error: '获取用户身份失败' }
  }

  if (!messageId) {
    return { success: false, error: '缺少消息ID' }
  }

  try {
    // 获取消息
    let messageData
    try {
      const msgRes = await db.collection('messages').doc(messageId).get()
      messageData = msgRes.data
    } catch (err) {
      return { success: false, error: '消息不存在' }
    }

    // 验证是否是消息发送者
    if (messageData.senderId !== openid) {
      return { success: false, error: '只能撤回自己的消息' }
    }

    // 验证消息是否已被撤回
    if (messageData.recalled) {
      return { success: false, error: '消息已撤回' }
    }

    // 验证撤回时间（2分钟内可撤回）
    const createTime = new Date(messageData.createTime).getTime()
    const now = Date.now()
    const twoMinutes = 2 * 60 * 1000

    if (now - createTime > twoMinutes) {
      return { success: false, error: '超过2分钟的消息不能撤回' }
    }

    // 更新消息为已撤回状态
    await db.collection('messages').doc(messageId).update({
      data: {
        recalled: true,
        recallTime: db.serverDate(),
        originalContent: messageData.content,
        originalType: messageData.type
      }
    })

    // 检查并更新会话的 lastMessage
    if (chatId) {
      try {
        // 获取最新的一条消息
        const latestMsgRes = await db.collection('messages')
          .where({ chatId })
          .orderBy('createTime', 'desc')
          .limit(1)
          .get()

        if (latestMsgRes.data && latestMsgRes.data.length > 0) {
          const latestMsg = latestMsgRes.data[0]
          // 如果撤回的是最后一条消息，更新会话显示
          if (latestMsg._id === messageId) {
            await db.collection('chats').doc(chatId).update({
              data: {
                lastMessage: {
                  content: '撤回了一条消息',
                  type: 'recalled',
                  senderId: openid,
                  time: db.serverDate()
                }
              }
            })
          }
        }
      } catch (e) {
        console.warn('更新会话lastMessage失败:', e)
      }
    }

    return {
      success: true,
      messageId
    }
  } catch (err) {
    console.error('recallMessage 错误:', err)
    return {
      success: false,
      error: err.message || '撤回消息失败'
    }
  }
}