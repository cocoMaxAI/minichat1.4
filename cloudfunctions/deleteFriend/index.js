const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { friendId } = event

  if (!openid || !friendId) {
    return { success: false, error: '参数错误' }
  }

  try {
    const [userId1, userId2] = [openid, friendId].sort()

    const res = await db.collection('friends')
      .where({ userId1, userId2, status: 'accepted' })
      .remove()

    return {
      success: true,
      deleted: res.stats.removed
    }
  } catch (err) {
    console.error('deleteFriend 错误:', err)
    return { success: false, error: err.message || '删除失败' }
  }
}