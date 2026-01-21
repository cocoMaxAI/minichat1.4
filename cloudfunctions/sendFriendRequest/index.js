const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { targetUserId } = event

  if (!openid) {
    return { success: false, error: '获取用户身份失败' }
  }

  if (!targetUserId) {
    return { success: false, error: '请选择有效的用户' }
  }

  if (openid === targetUserId) {
    return { success: false, error: '不能添加自己为好友' }
  }

  try {
    // 检查目标用户是否存在
    try {
      await db.collection('users').doc(targetUserId).get()
    } catch (err) {
      return { success: false, error: '用户不存在' }
    }

    // 检查是否已存在好友关系
    const existingRelation = await db.collection('friends')
      .where(_.or([
        { userId1: openid, userId2: targetUserId },
        { userId1: targetUserId, userId2: openid }
      ]))
      .limit(1)
      .get()

    if (existingRelation.data && existingRelation.data.length > 0) {
      const relation = existingRelation.data[0]
      
      if (relation.status === 'accepted') {
        return { success: true, message: '你们已经是好友了' }
      }
      
      if (relation.status === 'pending') {
        // 如果是对方发起的请求，直接同意成为好友
        if (relation.requesterId === targetUserId) {
          await db.collection('friends').doc(relation._id).update({
            data: {
              status: 'accepted',
              acceptTime: db.serverDate()
            }
          })
          return { success: true, message: '已成为好友' }
        } else {
          // 自己已经发起过请求
          return { success: false, error: '已发送过请求，请等待确认' }
        }
      }
    }

    // 创建新的好友请求
    await db.collection('friends').add({
      data: {
        userId1: openid,
        userId2: targetUserId,
        requesterId: openid,
        status: 'pending',
        createTime: db.serverDate()
      }
    })

    return { success: true, message: '好友请求已发送' }
  } catch (err) {
    console.error('sendFriendRequest 错误:', err)
    return { success: false, error: err.message || '发送请求失败' }
  }
}