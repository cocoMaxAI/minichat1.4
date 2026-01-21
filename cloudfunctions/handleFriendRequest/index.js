const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { requestId, action } = event

  if (!openid) {
    return { success: false, error: '获取用户身份失败' }
  }

  if (!requestId) {
    return { success: false, error: '请求ID不能为空' }
  }

  if (!['accept', 'reject'].includes(action)) {
    return { success: false, error: '无效的操作' }
  }

  try {
    // 获取好友请求
    let request
    try {
      const requestRes = await db.collection('friends').doc(requestId).get()
      request = requestRes.data
    } catch (err) {
      return { success: false, error: '请求不存在' }
    }

    // 验证当前用户是被请求者（不是发起者）
    const isReceiver = (request.userId1 === openid || request.userId2 === openid) && 
                       request.requesterId !== openid
    
    if (!isReceiver) {
      return { success: false, error: '无权处理此请求' }
    }

    if (request.status !== 'pending') {
      return { success: false, error: '请求已处理' }
    }

    if (action === 'accept') {
      await db.collection('friends').doc(requestId).update({
        data: {
          status: 'accepted',
          acceptTime: db.serverDate()
        }
      })
      return { success: true, message: '已添加为好友' }
    } else {
      // 拒绝请求 - 删除记录
      await db.collection('friends').doc(requestId).remove()
      return { success: true, message: '已拒绝' }
    }
  } catch (err) {
    console.error('handleFriendRequest 错误:', err)
    return { success: false, error: err.message || '处理失败' }
  }
}