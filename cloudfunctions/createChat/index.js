const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { targetUserId } = event

  if (!openid) {
    console.error('无法获取 openid')
    return { success: false, error: '获取用户身份失败，请重新登录' }
  }

  if (!targetUserId) {
    return { success: false, error: '请选择有效的联系人' }
  }

  if (openid === targetUserId) {
    return { success: false, error: '不能和自己创建会话' }
  }

  try {
    // 检查目标用户是否存在
    let targetUser
    try {
      const targetUserRes = await db.collection('users').doc(targetUserId).get()
      targetUser = targetUserRes.data
    } catch (err) {
      return { success: false, error: '用户不存在' }
    }

    // 检查是否已有会话
    const existChat = await db.collection('chats')
      .where({
        type: 'private',
        members: _.all([openid, targetUserId])
      })
      .limit(1)
      .get()

    if (existChat.data && existChat.data.length > 0) {
      const chat = existChat.data[0]
      if (Array.isArray(chat.members) && 
          chat.members.includes(openid) && 
          chat.members.includes(targetUserId)) {
        return {
          success: true,
          chatId: chat._id,
          isNew: false
        }
      }
    }

    // 获取当前用户信息
    let currentUser = { nickName: '用户', avatarUrl: '' }
    try {
      const currentUserRes = await db.collection('users').doc(openid).get()
      if (currentUserRes.data) {
        currentUser = currentUserRes.data
      }
    } catch (err) {
      console.warn('获取当前用户信息失败')
    }

    const memberInfo = {
      [openid]: {
        nickName: currentUser.nickName || '用户',
        avatarUrl: currentUser.avatarUrl || ''
      },
      [targetUserId]: {
        nickName: targetUser.nickName || '用户',
        avatarUrl: targetUser.avatarUrl || ''
      }
    }

    // 【关键修复】lastMessage 初始化为空对象，而非 null
    // 这样后续 sendMessage 更新时不会报错
    const chatRes = await db.collection('chats').add({
      data: {
        type: 'private',
        members: [openid, targetUserId],
        memberInfo,
        lastMessage: {},  // 【修复】改为空对象
        unreadCount: {
          [openid]: 0,
          [targetUserId]: 0
        },
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })

    return {
      success: true,
      chatId: chatRes._id,
      isNew: true
    }
  } catch (err) {
    console.error('createChat 错误:', err)
    return { success: false, error: err.message || '创建会话失败' }
  }
}