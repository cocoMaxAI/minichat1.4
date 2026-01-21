App({
    onLaunch: function () {
      if (!wx.cloud) {
        console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      } else {
        wx.cloud.init({
          env: 'cloud1-0gv3miveb9a3e45f',
          traceUser: true,
        })
      }
      
      this.restoreLoginState()
    },
  
    // 恢复登录状态
    restoreLoginState() {
      try {
        const userId = wx.getStorageSync('userId')
        const userInfo = wx.getStorageSync('userInfo')
        
        if (userId) {
          this.globalData.userId = userId
          this.globalData.userInfo = userInfo || {}
          console.log('已恢复登录状态:', userId)
        }
      } catch (e) {
        console.error('恢复登录状态失败:', e)
      }
    },
  
    clearLoginState() {
      this.globalData.userId = null
      this.globalData.userInfo = null
      wx.removeStorageSync('userId')
      wx.removeStorageSync('userInfo')
    },
  
    globalData: {
      userInfo: null,
      userId: null
    },
  
    resourceManager: {
      watchers: new Set(),
      timers: new Set(),
  
      registerWatcher(watcher) {
        this.watchers.add(watcher)
        return watcher
      },
  
      removeWatcher(watcher) {
        if (watcher) {
          watcher.close()
          this.watchers.delete(watcher)
        }
      },
  
      registerTimer(timer) {
        this.timers.add(timer)
        return timer
      },
  
      removeTimer(timer) {
        if (timer) {
          clearTimeout(timer)
          clearInterval(timer)
          this.timers.delete(timer)
        }
      },
  
      cleanup() {
        this.watchers.forEach(watcher => {
          try { watcher.close() } catch (e) {}
        })
        this.watchers.clear()
  
        this.timers.forEach(timer => {
          clearTimeout(timer)
          clearInterval(timer)
        })
        this.timers.clear()
      }
    },
  
    onHide() {},
  
    onUnload() {
      this.resourceManager.cleanup()
    }
  })