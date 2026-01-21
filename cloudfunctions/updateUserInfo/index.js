const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()


function isValidAvatarUrl(url) {
  if (!url) return true  // 空值允许（显示默认头像）
  if (url.startsWith('cloud://')) return true
  if (url.startsWith('https://')) return true
  return false
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { nickName, avatarUrl } = event

  if (!openid) {
    return { success: false, error: '获取用户身份失败' }
  }

  // 验证头像URL格式
  if (avatarUrl && !isValidAvatarUrl(avatarUrl)) {
    return { 
      success: false, 
      error: '头像URL无效，请重新上传头像到云存储' 
    }
  }

  try {
    const updateData = {
      updateTime: db.serverDate()
    }

    if (nickName !== undefined && nickName !== '') {
      updateData.nickName = nickName
    }
    if (avatarUrl !== undefined) {
      updateData.avatarUrl = avatarUrl
    }

    // 更新用户信息
    await db.collection('users').doc(openid).update({
      data: updateData
    })

    const chatsRes = await db.collection('chats')
      .where({
        members: db.command.elemMatch(db.command.eq(openid))
      })
      .get()

    if (chatsRes.data && chatsRes.data.length > 0) {
      const updatePromises = chatsRes.data.map(chat => {
        const memberInfoUpdate = {}
        if (nickName !== undefined) {
          memberInfoUpdate[`memberInfo.${openid}.nickName`] = nickName
        }
        if (avatarUrl !== undefined) {
          memberInfoUpdate[`memberInfo.${openid}.avatarUrl`] = avatarUrl
        }
        
        return db.collection('chats').doc(chat._id).update({
          data: memberInfoUpdate
        })
      })

      await Promise.all(updatePromises)
    }

    return {
      success: true,
      data: {
        nickName: nickName,
        avatarUrl: avatarUrl
      }
    }
  } catch (err) {
    console.error('updateUserInfo 错误:', err)
    return { success: false, error: err.message || '更新失败' }
  }
}