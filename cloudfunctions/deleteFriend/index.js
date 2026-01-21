const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { friendId } = event

  if (!openid || !friendId) {
    return { success: false, error: '参数错误' }
  }

  try {
    // 1. 删除好友关系 - 使用 or 匹配两种可能的存储顺序
    const friendRes = await db.collection('friends')
      .where(_.or([
        { userId1: openid, userId2: friendId },
        { userId1: friendId, userId2: openid }
      ]))
      .remove()

    console.log('删除好友关系结果:', friendRes.stats)

    // 2. 查找并删除两人之间的私聊会话
    const chatQueryRes = await db.collection('chats')
      .where({
        members: _.all([openid, friendId])
      })
      .get()

    let deletedChatCount = 0
    const deletedChatIds = []

    // 过滤出只有2个成员的私聊会话
    for (const chat of chatQueryRes.data) {
      if (Array.isArray(chat.members) && chat.members.length === 2) {
        try {
          await db.collection('chats').doc(chat._id).remove()
          deletedChatCount++
          deletedChatIds.push(chat._id)
        } catch (e) {
          console.error('删除会话失败:', chat._id, e)
        }
      }
    }

    console.log('删除会话结果:', deletedChatCount)

    // 3. 删除相关的聊天消息（可选，如果消息很多可以改用定时任务）
    if (deletedChatIds.length > 0) {
      try {
        await db.collection('messages')
          .where({
            chatId: _.in(deletedChatIds)
          })
          .remove()
        console.log('已删除相关消息')
      } catch (e) {
        console.error('删除消息失败:', e)
        // 消息删除失败不影响主流程
      }
    }

    return {
      success: true,
      deletedFriend: friendRes.stats.removed,
      deletedChat: deletedChatCount
    }
  } catch (err) {
    console.error('deleteFriend 错误:', err)
    return { success: false, error: err.message || '删除失败' }
  }
}