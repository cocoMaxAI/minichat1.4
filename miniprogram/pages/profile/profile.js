const app = getApp()

Page({
  data: {
    userInfo: {
      avatarUrl: '',
      nickName: ''
    },
    displayAvatarUrl: '',    // 新增：用于显示的头像 URL
    userId: '',
    originalUserInfo: {},
    uploading: false,
    saving: false,
    hasChanges: false,
    isInvalidAvatar: false,
    canSave: false
  },

  onLoad() {
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {}
    const userId = app.globalData.userId || wx.getStorageSync('userId') || ''
    
    const isInvalidAvatar = this.checkInvalidAvatar(userInfo.avatarUrl)
    
    this.setData({
      userInfo: { ...userInfo },
      originalUserInfo: { ...userInfo },
      userId: userId,
      isInvalidAvatar: isInvalidAvatar
    })

    // 处理头像显示
    this.resolveAvatarUrl(userInfo.avatarUrl)
  },

  // 新增：解析头像 URL（将 cloud:// 转换为可显示的 URL）
  async resolveAvatarUrl(avatarUrl) {
    if (!avatarUrl) {
      this.setData({ displayAvatarUrl: '' })
      return
    }

    // 如果是 https 链接，直接使用
    if (avatarUrl.startsWith('https://')) {
      this.setData({ displayAvatarUrl: avatarUrl })
      return
    }

    // 如果是 cloud:// 开头，需要转换
    if (avatarUrl.startsWith('cloud://')) {
      try {
        const res = await wx.cloud.getTempFileURL({
          fileList: [avatarUrl]
        })
        
        if (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) {
          this.setData({ 
            displayAvatarUrl: res.fileList[0].tempFileURL,
            isInvalidAvatar: false
          })
        } else {
          // 转换失败，使用默认头像
          console.warn('头像 URL 转换失败')
          this.setData({ 
            displayAvatarUrl: '',
            isInvalidAvatar: true
          })
        }
      } catch (err) {
        console.error('获取头像临时链接失败:', err)
        this.setData({ 
          displayAvatarUrl: '',
          isInvalidAvatar: true
        })
      }
      return
    }

    // 其他情况（临时文件路径等），标记为无效
    if (avatarUrl.startsWith('wxfile://') || avatarUrl.startsWith('http://tmp')) {
      this.setData({ 
        displayAvatarUrl: avatarUrl,  // 临时显示
        isInvalidAvatar: true
      })
      return
    }

    // 未知格式
    this.setData({ displayAvatarUrl: avatarUrl })
  },

  checkInvalidAvatar(url) {
    if (!url) return false
    return url.startsWith('wxfile://') || url.startsWith('http://tmp')
  },

  isValidAvatarUrl(url) {
    if (!url) return true
    return url.startsWith('cloud://') || url.startsWith('https://')
  },

  updateCanSave() {
    const { userInfo, originalUserInfo, uploading, saving } = this.data
    const hasChanges = userInfo.nickName !== originalUserInfo.nickName || 
                       userInfo.avatarUrl !== originalUserInfo.avatarUrl
    
    const avatarValid = this.isValidAvatarUrl(userInfo.avatarUrl)
    
    this.setData({
      hasChanges: hasChanges,
      canSave: hasChanges && !uploading && !saving && avatarValid
    })
  },

  onAvatarLoadError() {
    console.log('头像加载失败，使用默认头像')
    this.setData({
      displayAvatarUrl: '',
      isInvalidAvatar: true
    })
  },

  async onChooseAvatar(e) {
    const tempFilePath = e.detail.avatarUrl
    
    if (!tempFilePath) {
      wx.showToast({ title: '获取头像失败', icon: 'none' })
      return
    }
    
    // 先显示临时图片作为预览
    this.setData({
      'userInfo.avatarUrl': tempFilePath,
      displayAvatarUrl: tempFilePath,  // 直接显示临时路径
      uploading: true,
      isInvalidAvatar: false
    })
    this.updateCanSave()

    wx.showLoading({ title: '上传头像...' })
    
    try {
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(2, 10)
      const cloudPath = `avatars/${timestamp}_${randomStr}.jpg`
      
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: tempFilePath
      })
      
      wx.hideLoading()
      
      if (uploadRes.fileID) {
        this.setData({
          'userInfo.avatarUrl': uploadRes.fileID,
          uploading: false,
          isInvalidAvatar: false
        })
        // 解析新上传的头像 URL
        await this.resolveAvatarUrl(uploadRes.fileID)
        this.updateCanSave()
        console.log('头像上传成功:', uploadRes.fileID)
        wx.showToast({ title: '头像上传成功', icon: 'success' })
      } else {
        throw new Error('上传返回结果无效')
      }
    } catch (err) {
      console.error('头像上传失败:', err)
      wx.hideLoading()
      // 恢复原头像
      const originalAvatarUrl = this.data.originalUserInfo.avatarUrl || ''
      this.setData({ 
        'userInfo.avatarUrl': originalAvatarUrl,
        uploading: false,
        isInvalidAvatar: this.checkInvalidAvatar(originalAvatarUrl)
      })
      this.resolveAvatarUrl(originalAvatarUrl)
      this.updateCanSave()
      wx.showToast({ title: '头像上传失败，请重试', icon: 'none' })
    }
  },

  onInputNickname(e) {
    this.setData({
      'userInfo.nickName': e.detail.value
    })
    this.updateCanSave()
  },

  onNicknameBlur(e) {
    const nickName = e.detail.value.trim()
    this.setData({
      'userInfo.nickName': nickName
    })
    this.updateCanSave()
  },

  async saveProfile() {
    if (this.data.uploading) {
      wx.showToast({ title: '头像上传中，请稍候', icon: 'none' })
      return
    }

    const { userInfo, originalUserInfo } = this.data
    
    if (!this.isValidAvatarUrl(userInfo.avatarUrl)) {
      wx.showToast({ title: '请先重新上传头像', icon: 'none' })
      return
    }
    
    if (userInfo.nickName === originalUserInfo.nickName && 
        userInfo.avatarUrl === originalUserInfo.avatarUrl) {
      wx.showToast({ title: '没有需要保存的修改', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    this.updateCanSave()
    wx.showLoading({ title: '保存中...' })

    try {
      const res = await wx.cloud.callFunction({
        name: 'updateUserInfo',
        data: {
          nickName: userInfo.nickName,
          avatarUrl: userInfo.avatarUrl
        }
      })

      wx.hideLoading()

      if (res.result && res.result.success) {
        app.globalData.userInfo = { ...userInfo }
        wx.setStorageSync('userInfo', { ...userInfo })
        
        this.setData({
          originalUserInfo: { ...userInfo },
          saving: false,
          hasChanges: false,
          isInvalidAvatar: false
        })
        this.updateCanSave()

        wx.showToast({ title: '保存成功', icon: 'success' })
        
        setTimeout(() => {
          wx.navigateBack()
        }, 1000)
      } else {
        throw new Error(res.result?.error || '保存失败')
      }
    } catch (err) {
      console.error('保存资料失败:', err)
      wx.hideLoading()
      this.setData({ saving: false })
      this.updateCanSave()
      wx.showToast({ title: err.message || '保存失败', icon: 'none' })
    }
  }
})