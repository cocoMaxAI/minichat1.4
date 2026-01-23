const app = getApp()

Page({
  data: {
    keyword: '',
    searchResults: [],
    loading: false,
    searched: false
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  async onSearch() {
    const keyword = this.data.keyword.trim()
    if (!keyword) {
      wx.showToast({ title: '请输入搜索内容', icon: 'none' })
      return
    }
  
    this.setData({ loading: true, searched: true })
  
    try {
      const res = await wx.cloud.callFunction({
        name: 'searchUsers',
        data: { keyword }
      })
  
      console.log('searchUsers 返回结果:', res)  // 添加日志
  
      // 检查云函数是否正确返回
      if (!res.result) {
        throw new Error('云函数返回为空，请检查是否已部署')
      }
  
      if (res.result.success) {
        this.setData({ searchResults: res.result.data || [] })
      } else {
        // 显示云函数返回的具体错误
        throw new Error(res.result.error || res.result.errorDetail || '搜索失败')
      }
    } catch (err) {
      console.error('搜索失败:', err)
      wx.showToast({ 
        title: err.message || '搜索失败', 
        icon: 'none',
        duration: 3000  // 延长显示时间便于查看
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  async onAddFriend(e) {
    const user = e.currentTarget.dataset.user
  
    if (user.friendStatus === 'accepted') {
      wx.showToast({ title: '已经是好友了', icon: 'none' })
      return
    }
  
    if (user.friendStatus === 'pending' && user.isRequester) {
      wx.showToast({ title: '已发送过请求', icon: 'none' })
      return
    }
  
    wx.showLoading({ title: '发送中...' })
  
    try {
      const res = await wx.cloud.callFunction({
        name: 'sendFriendRequest',
        data: { targetUserId: user._id }
      })
  
      if (res.result && res.result.success) {
        wx.showToast({ title: res.result.message || '请求已发送', icon: 'success' })
        
        const results = this.data.searchResults.map(u => {
          if (u._id === user._id) {
            return { 
              ...u, 
              friendStatus: res.result.status,  // 直接使用返回的 status
              isRequester: true 
            }
          }
          return u
        })
        this.setData({ searchResults: results })
      } else {
        throw new Error(res.result?.error || '发送失败')
      }
    } catch (err) {
      console.error('发送请求失败:', err)
      wx.showToast({ title: err.message || '发送失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  goToRequests() {
    wx.navigateTo({ url: '/pages/friendRequests/friendRequests' })
  }
})