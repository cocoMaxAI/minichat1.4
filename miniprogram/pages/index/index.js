const app = getApp()

Page({
  data: {
    chatList: [],
    displayList: [],     
    searchKeyword: '', 
    userList: [],
    loading: false,
    hasMore: true,
    page: 0,
    pageSize: 20,
    showContactModal: false,
    showUserMenu: false,  
    userInfo: {},
    scrollTop: 0,
    defaultAvatar: '/images/default-avatar.png'
  },

  watcher: null,
  watcherTimer: null,     
  isPageActive: false,    
  searchTimer: null,

  onLoad() {
    this.isPageActive = true  
    this.checkLogin()
  },

  onUserAvatarError() {
    console.log('用户头像加载失败')
    this.setData({
      'userInfo.avatarUrl': ''
    })
  },

  onChatAvatarError(e) {
    const index = e.currentTarget.dataset.index
    console.log('会话头像加载失败, index:', index)
    this.setData({
      [`displayList[${index}].displayAvatar`]: ''
    })
  },

  onContactAvatarError(e) {
    const index = e.currentTarget.dataset.index
    console.log('联系人头像加载失败, index:', index)
    this.setData({
      [`userList[${index}].avatarUrl`]: ''
    })
  },

  onAvatarTap() {
    wx.showActionSheet({
      itemList: ['编辑资料', '好友请求', '切换账号', '退出登录'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            wx.navigateTo({ url: '/pages/profile/profile' })
            break
          case 1:
            wx.navigateTo({ url: '/pages/friendRequests/friendRequests' })
            break
          case 2:
            this.switchAccount()
            break
          case 3:
            this.confirmLogout()
            break
        }
      }
    })
  },

  onShow() {
    this.isPageActive = true
    
    if (app.globalData.userId) {
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {}
      this.setData({ userInfo })
      this.refreshChatList()
      this.startWatcher()
    }
  },

  onHide() {
    this.isPageActive = false
    this.closeWatcher()
  },

  onUnload() {
    this.isPageActive = false
    this.closeWatcher()
    if (this.searchTimer) {
      clearTimeout(this.searchTimer)
      this.searchTimer = null
    }
  },

  async checkLogin() {
    if (!app.globalData.userId) {
      const storedUserId = wx.getStorageSync('userId')
      if (storedUserId) {
        app.globalData.userId = storedUserId
        app.globalData.userInfo = wx.getStorageSync('userInfo') || {}
      }
    }
  
    if (!app.globalData.userId) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }

    this.setData({
      userInfo: app.globalData.userInfo || {}
    })
  
    await this.loadChatList()
  },

  async loadChatList(isRefresh = true) {
    if (this.data.loading) return
    if (!isRefresh && !this.data.hasMore) return

    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'getChatList',
        data: {
          page: isRefresh ? 0 : this.data.page,
          pageSize: this.data.pageSize
        }
      })

      if (res.result && res.result.success) {
        const newList = this.formatChatList(res.result.data || [])
        const chatList = isRefresh ? newList : [...this.data.chatList, ...newList]
        
        this.setData({
          chatList,
          displayList: this.filterByKeyword(chatList, this.data.searchKeyword),
          page: isRefresh ? 1 : this.data.page + 1,
          hasMore: res.result.hasMore,
          loading: false
        })
      } else {
        throw new Error(res.result?.error || '加载失败')
      }
    } catch (err) {
      console.error('加载会话列表失败:', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  refreshChatList() {
    this.setData({ page: 0, hasMore: true })
    this.loadChatList(true)
  },

  onSearchInput(e) {
    const keyword = e.detail.value
    this.setData({ searchKeyword: keyword })
    
    if (this.searchTimer) {
      clearTimeout(this.searchTimer)
    }
    
    this.searchTimer = setTimeout(() => {
      this.doSearch(keyword)
    }, 300)
  },

  onSearchConfirm(e) {
    const keyword = e.detail.value
    if (this.searchTimer) {
      clearTimeout(this.searchTimer)
    }
    this.doSearch(keyword)
  },

  clearSearch() {
    this.setData({
      searchKeyword: '',
      displayList: this.data.chatList
    })
  },

  doSearch(keyword) {
    const filteredList = this.filterByKeyword(this.data.chatList, keyword)
    this.setData({ displayList: filteredList })
  },

  filterByKeyword(list, keyword) {
    if (!keyword || !keyword.trim()) {
      return list
    }
    
    const lowerKeyword = keyword.toLowerCase().trim()
    
    return list.filter(chat => {
      const nameMatch = chat.displayName && 
        chat.displayName.toLowerCase().includes(lowerKeyword)
      
      const contentMatch = chat.lastMessage && 
        chat.lastMessage.content && 
        chat.lastMessage.content.toLowerCase().includes(lowerKeyword)
      
      return nameMatch || contentMatch
    })
  },

  formatChatList(list) {
    if (!Array.isArray(list)) return []
    
    return list.map(chat => {
      let timeStr = ''
      if (chat.lastMessage && chat.lastMessage.time) {
        timeStr = this.formatTime(new Date(chat.lastMessage.time))
      }
      
      return {
        ...chat,
        lastMessage: {
          ...(chat.lastMessage || {}),
          timeStr
        }
      }
    })
  },

  formatTime(date) {
    if (!date || isNaN(date.getTime())) return ''
    
    const now = new Date()
    const diff = now - date
    const oneDay = 24 * 60 * 60 * 1000

    if (diff < oneDay && date.getDate() === now.getDate()) {
      return `${this.padZero(date.getHours())}:${this.padZero(date.getMinutes())}`
    } else if (diff < 2 * oneDay) {
      return '昨天'
    } else if (diff < 7 * oneDay) {
      const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      return days[date.getDay()]
    } else {
      return `${date.getMonth() + 1}/${date.getDate()}`
    }
  },

  padZero(num) {
    return num < 10 ? '0' + num : num
  },

  startWatcher() {
    if (!app.globalData.userId) {
      console.warn('userId 不存在，跳过启动监听器')
      return
    }

    this.closeWatcher()

    if (!this.isPageActive) {
      console.log('页面不活跃，跳过启动监听器')
      return
    }

    this.watcherTimer = setTimeout(() => {
      if (!this.isPageActive) {
        console.log('页面已不活跃，取消创建监听器')
        return
      }

      if (!app.globalData.userId) {
        console.log('userId 已失效，取消创建监听器')
        return
      }

      try {
        const db = wx.cloud.database()
        const _ = db.command
        
        this.watcher = db.collection('chats')
          .where({
            members: _.elemMatch(_.eq(app.globalData.userId))
          })
          .watch({
            onChange: (snapshot) => {
              if (!this.isPageActive) {
                console.log('收到变更但页面不活跃，忽略')
                return
              }
              console.log('会话数据变化:', snapshot.type)
              if (snapshot.docChanges && snapshot.docChanges.length > 0) {
                this.refreshChatList()
              }
            },
            onError: (err) => {
              console.error('监听失败:', err)
              if (this.isPageActive && app.globalData.userId) {
                setTimeout(() => {
                  if (this.isPageActive && app.globalData.userId) {
                    this.startWatcher()
                  }
                }, 5000)
              }
            }
          })
        
        console.log('监听器创建成功')
      } catch (err) {
        console.error('启动监听器失败:', err)
      }
    }, 500)
  },

  closeWatcher() {
    if (this.watcherTimer) {
      clearTimeout(this.watcherTimer)
      this.watcherTimer = null
    }

    if (this.watcher) {
      try {
        this.watcher.close()
        console.log('监听器已关闭')
      } catch (e) {
        console.log('关闭监听器:', e.message || e)
      }
      this.watcher = null
    }
  },

  loadMore() {
    if (!this.data.loading && this.data.hasMore) {
      this.loadChatList(false)
    }
  },

  enterChat(e) {
    const chat = e.currentTarget.dataset.chat
    wx.navigateTo({
      url: `/pages/chat/chat?chatId=${chat._id}&name=${encodeURIComponent(chat.displayName || '聊天')}`
    })
  },

  async onAddChat() {
    if (!app.globalData.userId) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
  
    wx.showLoading({ title: '加载中...' })
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'getFriends'
      })
  
      if (res.result && res.result.success) {
        this.setData({
          userList: res.result.data || [],
          showContactModal: true
        })
      } else {
        throw new Error(res.result?.error || '加载失败')
      }
    } catch (err) {
      console.error('加载好友失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  goToAddFriend() {
    this.setData({ showContactModal: false })
    wx.navigateTo({ url: '/pages/addFriend/addFriend' })
  },

  hideContactModal() {
    this.setData({ showContactModal: false })
  },

  stopPropagation() {},

  async selectContact(e) {
    const user = e.currentTarget.dataset.user
    
    if (!user || !user._id) {
      wx.showToast({ title: '用户信息无效', icon: 'none' })
      return
    }
  
    this.setData({ showContactModal: false })
    wx.showLoading({ title: '创建会话...' })
  
    try {
      const res = await wx.cloud.callFunction({
        name: 'createChat',
        data: { targetUserId: user._id }
      })
  
      if (res.result && res.result.success) {
        wx.navigateTo({
          url: `/pages/chat/chat?chatId=${res.result.chatId}&name=${encodeURIComponent(user.nickName || '聊天')}`
        })
      } else {
        throw new Error(res.result?.error || '创建会话失败')
      }
    } catch (err) {
      console.error('创建会话失败:', err)
      wx.showToast({ title: err.message || '创建失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // ========== 【新增】长按好友弹出操作菜单 ==========
  onFriendLongPress(e) {
    const user = e.currentTarget.dataset.user
    const index = e.currentTarget.dataset.index

    if (!user || !user._id) {
      return
    }

    wx.showActionSheet({
      itemList: ['发送消息', '删除好友'],
      itemColor: '#000000',
      success: (res) => {
        if (res.tapIndex === 0) {
          // 发送消息
          this.selectContact(e)
        } else if (res.tapIndex === 1) {
          // 删除好友
          this.confirmDeleteFriend(user, index)
        }
      }
    })
  },

  // ========== 【新增】点击删除按钮（可选方式） ==========
  onDeleteFriend(e) {
    const user = e.currentTarget.dataset.user
    const index = e.currentTarget.dataset.index

    if (!user || !user._id) {
      wx.showToast({ title: '用户信息无效', icon: 'none' })
      return
    }

    this.confirmDeleteFriend(user, index)
  },

  // ========== 【新增】确认删除好友 ==========
  confirmDeleteFriend(user, index) {
    wx.showModal({
      title: '删除好友',
      content: `确定要删除好友"${user.nickName || '该用户'}"吗？删除后需要重新添加才能聊天。`,
      confirmText: '删除',
      confirmColor: '#FA5151',
      success: (res) => {
        if (res.confirm) {
          this.doDeleteFriend(user, index)
        }
      }
    })
  },

  async doDeleteFriend(user, index) {
    wx.showLoading({ title: '删除中...' })
  
    try {
      const res = await wx.cloud.callFunction({
        name: 'deleteFriend',
        data: { friendId: user._id }
      })
  
      if (res.result && res.result.success) {
        wx.showToast({ title: '已删除', icon: 'success' })
        
        // 更新好友列表UI
        const newUserList = this.data.userList.filter((_, i) => i !== index)
        this.setData({ userList: newUserList })
        
        // 关键：刷新会话列表，删除与该好友的会话
        this.refreshChatList()
        
        // 如果好友列表为空，可以选择关闭弹窗
        if (newUserList.length === 0) {
          setTimeout(() => this.setData({ showContactModal: false }), 500)
        }
      } else {
        throw new Error(res.result?.error || '删除失败')
      }
    } catch (err) {
      console.error('删除好友失败:', err)
      wx.showToast({ title: err.message || '删除失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },
  
  onPullDownRefresh() {
    this.refreshChatList()
    wx.stopPullDownRefresh()
  },

  showUserMenu() {
    this.setData({ showUserMenu: true })
  },

  hideUserMenu() {
    this.setData({ showUserMenu: false })
  },

  confirmLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      confirmColor: '#07C160',
      success: (res) => {
        if (res.confirm) {
          this.doLogout()
        }
      }
    })
  },

  doLogout() {
    this.isPageActive = false
    this.closeWatcher()
    
    if (this.searchTimer) {
      clearTimeout(this.searchTimer)
      this.searchTimer = null
    }
    
    this.setData({
      chatList: [],
      displayList: [],
      searchKeyword: '',
      userList: [],
      page: 0,
      hasMore: true
    })
    
    app.clearLoginState()
    
    wx.reLaunch({ url: '/pages/login/login' })
  },

  switchAccount() {
    wx.showModal({
      title: '切换账号',
      content: '将退出当前账号并重新登录，确定继续？',
      confirmColor: '#07C160',
      success: (res) => {
        if (res.confirm) {
          this.doLogout()
        }
      }
    })
  },

  goToFriendRequests() {
    this.setData({ showUserMenu: false })
    wx.navigateTo({ url: '/pages/friendRequests/friendRequests' })
  }
})