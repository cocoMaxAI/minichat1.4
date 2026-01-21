const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 验证头像URL是否有效
function isValidAvatarUrl(url) {
  if (!url || typeof url !== 'string') return false
  // 只接受云存储URL或https URL
  return url.startsWith('cloud://') || url.startsWith('https://')
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { userInfo } = event

  try {
    // 安全处理 userInfo，验证URL有效性
    const nickName = userInfo?.nickName || '微信用户'
    // 【关键】只接受有效的头像URL
    const avatarUrl = isValidAvatarUrl(userInfo?.avatarUrl) ? userInfo.avatarUrl : ''

    console.log('登录处理 - openid:', openid)
    console.log('登录处理 - 传入头像:', userInfo?.avatarUrl)
    console.log('登录处理 - 验证后头像:', avatarUrl)

    // 检查用户是否存在
    let userRes = null
    try {
      userRes = await db.collection('users').doc(openid).get()
    } catch (err) {
      // 用户不存在
      userRes = null
    }

    let finalUserInfo = {
      nickName,
      avatarUrl
    }

    if (userRes && userRes.data) {
      // 老用户
      const existingData = userRes.data
      const updateData = {
        lastLoginTime: db.serverDate()
      }
      
      // 【关键】检测并修复数据库中的无效头像URL
      if (!isValidAvatarUrl(existingData.avatarUrl)) {
        console.log('检测到数据库中存在无效头像URL，将清除:', existingData.avatarUrl)
        updateData.avatarUrl = ''  // 清除无效URL
      }

      // 只有传入了有效的用户信息才更新
      if (userInfo?.nickName) {
        updateData.nickName = nickName
      }
      if (isValidAvatarUrl(userInfo?.avatarUrl)) {
        updateData.avatarUrl = avatarUrl
      }

      await db.collection('users').doc(openid).update({
        data: updateData
      })

      // 返回数据库中的用户信息（优先使用新传入的有效数据）
      finalUserInfo = {
        nickName: userInfo?.nickName || existingData.nickName || '微信用户',
        avatarUrl: isValidAvatarUrl(userInfo?.avatarUrl) 
          ? avatarUrl 
          : (isValidAvatarUrl(existingData.avatarUrl) ? existingData.avatarUrl : '')
      }
    } else {
      // 新用户，创建记录
      await db.collection('users').add({
        data: {
          _id: openid,
          nickName,
          avatarUrl,  // 已验证过的有效URL或空字符串
          createTime: db.serverDate(),
          lastLoginTime: db.serverDate()
        }
      })
    }

    console.log('登录成功，返回用户信息:', finalUserInfo)

    return {
      success: true,
      userId: openid,
      userInfo: finalUserInfo
    }
  } catch (err) {
    console.error('登录云函数错误:', err)
    return {
      success: false,
      error: err.message || '服务器错误'
    }
  }
}