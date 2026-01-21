const app = getApp()

Page({
  data: {
    agreed: false,
    userInfo: {
      avatarUrl: '',
      nickName: ''
    },
    uploading: false
  },

  toggleAgreement() {
    this.setData({ agreed: !this.data.agreed })
  },

  // 检查是否是有效的头像URL（只接受云存储URL）
  isValidAvatarUrl(url) {
    if (!url || typeof url !== 'string') return false
    return url.startsWith('cloud://') || url.startsWith('https://')
  },

  async onChooseAvatar(e) {
    const tempFilePath = e.detail.avatarUrl
    
    // 先显示临时图片作为预览（但标记为临时）
    this.setData({
      'userInfo.avatarUrl': tempFilePath,
      'userInfo._tempAvatar': true,  // 标记为临时头像
      uploading: true
    })

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
          'userInfo._tempAvatar': false,
          uploading: false
        })
        console.log('头像上传成功:', uploadRes.fileID)
        wx.showToast({ title: '头像上传成功', icon: 'success' })
      } else {
        throw new Error('上传失败')
      }
    } catch (err) {
      console.error('头像上传失败:', err)
      wx.hideLoading()
      // 【关键】上传失败时清空头像，不保留临时路径
      this.setData({ 
        'userInfo.avatarUrl': '',
        'userInfo._tempAvatar': false,
        uploading: false 
      })
      wx.showToast({ title: '头像上传失败，请重试', icon: 'none' })
    }
  },

  onInputNickname(e) {
    this.setData({
      'userInfo.nickName': e.detail.value
    })
  },

  async handleLogin() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意用户协议', icon: 'none' })
      return
    }
  
    if (this.data.uploading) {
      wx.showToast({ title: '头像上传中，请稍候', icon: 'none' })
      return
    }
  
    // 【新增】检查头像是否是有效的云存储路径
    const avatarUrl = this.data.userInfo.avatarUrl
    if (avatarUrl && (avatarUrl.startsWith('wxfile://') || avatarUrl.startsWith('http://tmp/'))) {
      wx.showToast({ title: '头像上传未完成，请重试', icon: 'none' })
      // 清空无效的头像
      this.setData({ 'userInfo.avatarUrl': '' })
      return
    }
  
    let isLoading = false
  
    try {
      wx.showLoading({ title: '登录中...' })
      isLoading = true
  
      const loginRes = await wx.login()
      
      if (!loginRes.code) {
        throw new Error('获取登录凭证失败')
      }
  
      // 【关键】只传递有效的头像URL
      const userInfo = {
        nickName: this.data.userInfo.nickName || '',
        avatarUrl: avatarUrl || ''  // 此时已确保是有效路径或空字符串
      }
  
      const res = await wx.cloud.callFunction({
        name: 'login',
        data: {
          code: loginRes.code,
          userInfo: userInfo
        }
      })
  
      console.log('登录返回结果:', res)
  
      if (res.result && res.result.success) {
        app.globalData.userId = res.result.userId
        app.globalData.userInfo = res.result.userInfo
  
        wx.setStorageSync('userId', res.result.userId)
        wx.setStorageSync('userInfo', res.result.userInfo)
  
        wx.hideLoading()
        isLoading = false
        
        wx.showToast({ title: '登录成功', icon: 'success' })
        
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/index/index' })
        }, 500)
      } else {
        throw new Error(res.result?.error || '登录失败')
      }
    } catch (err) {
      console.error('登录失败:', err)
      if (isLoading) {
        wx.hideLoading()
      }
      wx.showToast({ title: err.message || '登录失败', icon: 'none' })
    }
  }
})