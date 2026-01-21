const app = getApp()

Page({
  data: {
    requests: [],
    loading: false
  },

  onLoad() {
    this.loadRequests()
  },

  onShow() {
    this.loadRequests()
  },

  async loadRequests() {
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'getFriendRequests'
      })

      if (res.result && res.result.success) {
        this.setData({ requests: res.result.data || [] })
      } else {
        throw new Error(res.result?.error || '加载失败')
      }
    } catch (err) {
      console.error('加载请求列表失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async handleRequest(e) {
    const { request, action } = e.currentTarget.dataset

    wx.showLoading({ title: '处理中...' })

    try {
      const res = await wx.cloud.callFunction({
        name: 'handleFriendRequest',
        data: {
          requestId: request._id,
          action
        }
      })

      if (res.result && res.result.success) {
        wx.showToast({ title: res.result.message, icon: 'success' })
        // 刷新列表
        this.loadRequests()
      } else {
        throw new Error(res.result?.error || '处理失败')
      }
    } catch (err) {
      console.error('处理请求失败:', err)
      wx.showToast({ title: err.message || '处理失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  }
})