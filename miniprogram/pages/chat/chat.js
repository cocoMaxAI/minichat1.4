const app = getApp()

Page({
  data: {
    chatId: '',
    chatType: 'private',
    messageList: [],
    inputValue: '',
    inputFocus: false,
    showVoice: false,
    showEmoji: false,
    showMore: false,
    keyboardHeight: 0,
    scrollToMessage: '',
    scrollTop: 0,
    loading: false,
    loadingMore: false,
    hasMore: true,
    userId: '',
    userInfo: null,
    pageSize: 20,
    showMessageMenu: false,
    selectedMessage: null,
    menuPosition: { x: 0, y: 0 },
    recallTimeLimit: 2 * 60 * 1000,
    windowHeight: 0,
    defaultAvatar: '/images/default-avatar.png',
    deletedMessageIds: [],
    // 表情相关数据
    emojiList: [],
    emojiCategories: [
      { name: '常用', key: 'frequent' },
      { name: '表情', key: 'face' },
      { name: '手势', key: 'gesture' },
      { name: '符号', key: 'symbol' }
    ],
    currentEmojiCategory: 'frequent',
    recentEmojis: []  // 最近使用的表情
  },

  onLoad(options) {
    const { chatId, name } = options
    
    this._chatId = chatId
    this._isPageActive = true
    this._sendingMessageIds = new Set()
    this.messageWatcher = null
    this.imageList = []
    this.scrollTimer = null
    this._urlCache = {}
    this._convertingUrls = new Map()
    this._scrollCount = 0
    
    const decodedName = name ? decodeURIComponent(name) : '聊天'
    wx.setNavigationBarTitle({ title: decodedName })

    const sysInfo = wx.getSystemInfoSync()
    
    // 读取本地删除记录
    const deletedKey = `deleted_msgs_${chatId}`
    const deletedIds = wx.getStorageSync(deletedKey) || []
    
    // 读取最近使用的表情
    const recentEmojis = wx.getStorageSync('recent_emojis') || []
    
    this.setData({
      chatId,
      userId: app.globalData.userId,
      userInfo: app.globalData.userInfo || {},
      windowHeight: sysInfo.windowHeight,
      deletedMessageIds: deletedIds,
      recentEmojis: recentEmojis
    })

    // 初始化表情列表
    this.initEmojiList()

    this.convertUserAvatar().then(() => {
      this.loadMessages()
      this.startMessageWatcher()
    })
  },

  // 初始化表情列表
  initEmojiList() {
    const emojiData = {
      frequent: ['😀', '😂', '😍', '🥰', '😘', '😊', '🤔', '😅', '😭', '😱', '👍', '👎', '❤️', '🔥', '💯', '🎉', '👏', '🙏', '💪', '✨'],
      face: [
        '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
        '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚',
        '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭',
        '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄',
        '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒',
        '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠',
        '🥳', '🥸', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮',
        '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢',
        '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤',
        '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹',
        '👺', '👻', '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼'
      ],
      gesture: [
        '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
        '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
        '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
        '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂',
        '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅',
        '👄', '💋', '🩸', '👶', '🧒', '👦', '👧', '🧑', '👱', '👨'
      ],
      symbol: [
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
        '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝',
        '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️',
        '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎',
        '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️',
        '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮',
        '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎',
        '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯',
        '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗',
        '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸',
        '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎',
        '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🛗',
        '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '⚧️',
        '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠',
        '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣',
        '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣',
        '⏏️', '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪',
        '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️',
        '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀',
        '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️',
        '🟰', '♾️', '💲', '💱', '™️', '©️', '®️', '👁️‍🗨️', '🔚', '🔙',
        '🔛', '🔝', '🔜', '〰️', '➰', '➿', '✔️', '☑️', '🔘', '🔴',
        '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻',
        '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾', '◽',
        '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜',
        '🟫', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '💬',
        '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄', '🕐'
      ]
    }
    
    this.emojiData = emojiData
    
    // 设置当前分类的表情
    this.setData({
      emojiList: this.getEmojiListByCategory('frequent')
    })
  },

  // 根据分类获取表情列表
  getEmojiListByCategory(category) {
    if (category === 'frequent') {
      // 如果有最近使用的表情，优先显示
      const recent = this.data.recentEmojis || []
      if (recent.length > 0) {
        // 合并最近使用和默认常用
        const merged = [...new Set([...recent, ...this.emojiData.frequent])]
        return merged.slice(0, 40)
      }
      return this.emojiData.frequent
    }
    return this.emojiData[category] || []
  },

  // 切换表情分类
  switchEmojiCategory(e) {
    const category = e.currentTarget.dataset.category
    this.setData({
      currentEmojiCategory: category,
      emojiList: this.getEmojiListByCategory(category)
    })
  },

  // 选择表情
  selectEmoji(e) {
    const emoji = e.currentTarget.dataset.emoji
    if (!emoji) return
    
    // 将表情插入到输入框
    const currentValue = this.data.inputValue
    this.setData({
      inputValue: currentValue + emoji
    })
    
    // 保存到最近使用
    this.saveRecentEmoji(emoji)
  },

  // 保存最近使用的表情
  saveRecentEmoji(emoji) {
    let recentEmojis = this.data.recentEmojis || []
    
    // 移除重复的
    recentEmojis = recentEmojis.filter(e => e !== emoji)
    
    // 添加到开头
    recentEmojis.unshift(emoji)
    
    // 最多保存20个
    if (recentEmojis.length > 20) {
      recentEmojis = recentEmojis.slice(0, 20)
    }
    
    this.setData({ recentEmojis })
    
    // 持久化到本地存储
    wx.setStorageSync('recent_emojis', recentEmojis)
    
    // 如果当前在常用分类，更新列表
    if (this.data.currentEmojiCategory === 'frequent') {
      this.setData({
        emojiList: this.getEmojiListByCategory('frequent')
      })
    }
  },

  // 删除输入框最后一个字符（表情删除按钮）
  deleteInputChar() {
    const currentValue = this.data.inputValue
    if (!currentValue) return
    
    // 处理 emoji（可能占多个字符）
    const arr = Array.from(currentValue)
    arr.pop()
    
    this.setData({
      inputValue: arr.join('')
    })
  },

  onUnload() {
    this._isPageActive = false
    this.closeMessageWatcher()
    
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer)
      this.scrollTimer = null
    }
    
    if (this._sendingMessageIds) {
      this._sendingMessageIds.clear()
    }
    
    if (this._convertingUrls) {
      this._convertingUrls.clear()
    }
  },

  onHide() {
    this.closeMessageWatcher()
    this.setData({ 
      showMessageMenu: false,
      showEmoji: false,
      showMore: false
    })
  },

  onShow() {
    if (this._chatId && this._isPageActive && !this.messageWatcher) {
      this.loadMessages()
      this.startMessageWatcher()
    }
  },

  isCloudUrl(url) {
    return url && typeof url === 'string' && url.startsWith('cloud://')
  },

  isInvalidLocalUrl(url) {
    if (!url || typeof url !== 'string') return true
    return url.startsWith('http://tmp/') || 
           url.startsWith('wxfile://') || 
           url.startsWith('file://') ||
           url.startsWith('/tmp/') ||
           url.includes('tmp_')
  },

  isValidDisplayUrl(url) {
    if (!url || typeof url !== 'string') return false
    return url.startsWith('https://') || 
           url.startsWith('/images/') ||
           url.startsWith('/pages/')
  },

  getSafeAvatarUrl(avatarUrl) {
    if (!avatarUrl) return this.data.defaultAvatar
    
    if (this.isInvalidLocalUrl(avatarUrl)) {
      return this.data.defaultAvatar
    }
    
    if (this.isCloudUrl(avatarUrl)) {
      if (this._urlCache[avatarUrl]) {
        return this._urlCache[avatarUrl]
      }
      return this.data.defaultAvatar
    }
    
    if (avatarUrl.startsWith('https://')) {
      return avatarUrl
    }
    
    return this.data.defaultAvatar
  },

  async convertUserAvatar() {
    const avatarUrl = this.data.userInfo?.avatarUrl
    if (this.isCloudUrl(avatarUrl)) {
      const tempUrl = await this.convertUrlViaCloudFunction(avatarUrl)
      if (tempUrl && tempUrl !== avatarUrl) {
        this.setData({ 'userInfo.avatarUrl': tempUrl })
      }
    }
  },

  async onImageError(e) {
    const msgId = e.currentTarget.dataset.msgid
    const originalUrl = e.currentTarget.dataset.url
    
    console.warn('图片加载失败:', msgId, originalUrl)
    
    if (this.isCloudUrl(originalUrl)) {
      delete this._urlCache[originalUrl]
      
      try {
        const newUrl = await this.convertUrlViaCloudFunction(originalUrl)
        if (newUrl && newUrl !== originalUrl) {
          const list = this.data.messageList.map(msg => {
            if (msg._id === msgId) {
              return { ...msg, content: newUrl, originalCloudUrl: originalUrl, loadError: false }
            }
            return msg
          })
          this.setData({ messageList: list })
          return
        }
      } catch (err) {
        console.error('重新转换URL失败:', err)
      }
    }
    
    const list = this.data.messageList.map(msg => {
      if (msg._id === msgId) {
        return { ...msg, loadError: true }
      }
      return msg
    })
    this.setData({ messageList: list })
  },

  onAvatarError(e) {
    const msgId = e.currentTarget.dataset.msgid
    const isSelf = e.currentTarget.dataset.isself
    console.warn('头像加载失败:', msgId, isSelf ? '自己' : '对方')
    
    if (!isSelf && msgId) {
      const list = this.data.messageList.map(msg => {
        if (msg._id === msgId && msg.senderInfo) {
          return {
            ...msg,
            senderInfo: {
              ...msg.senderInfo,
              avatarUrl: this.data.defaultAvatar
            }
          }
        }
        return msg
      })
      this.setData({ messageList: list })
    }
  },

  async retryLoadImage(e) {
    const msgId = e.currentTarget.dataset.msgid
    const msg = this.data.messageList.find(m => m._id === msgId)
    
    if (!msg) return
    
    wx.showLoading({ title: '加载中...' })
    
    try {
      let cloudUrl = msg.originalCloudUrl || msg.content
      
      if (!this.isCloudUrl(cloudUrl)) {
        const db = wx.cloud.database()
        const res = await db.collection('messages').doc(msgId).get()
        if (res.data && res.data.content) {
          cloudUrl = res.data.content
        }
      }
      
      if (this.isCloudUrl(cloudUrl)) {
        delete this._urlCache[cloudUrl]
        
        const newUrl = await this.convertUrlViaCloudFunction(cloudUrl)
        if (newUrl && newUrl !== cloudUrl) {
          const list = this.data.messageList.map(m => {
            if (m._id === msgId) {
              return { 
                ...m, 
                content: newUrl, 
                originalCloudUrl: cloudUrl,
                loadError: false 
              }
            }
            return m
          })
          this.setData({ messageList: list })
          wx.showToast({ title: '加载成功', icon: 'success' })
          return
        }
      }
      
      wx.showToast({ title: '加载失败', icon: 'none' })
    } catch (err) {
      console.error('重试加载图片失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async convertUrlViaCloudFunction(cloudUrl) {
    if (!this.isCloudUrl(cloudUrl)) return cloudUrl
    
    if (this._urlCache[cloudUrl]) {
      return this._urlCache[cloudUrl]
    }
    
    if (this._convertingUrls.has(cloudUrl)) {
      return this._convertingUrls.get(cloudUrl)
    }
    
    const convertPromise = (async () => {
      try {
        const res = await wx.cloud.callFunction({
          name: 'convertTempUrl',
          data: {
            fileList: [cloudUrl]
          }
        })
        
        if (res.result && res.result.success && res.result.urlMap[cloudUrl]) {
          const tempUrl = res.result.urlMap[cloudUrl]
          this._urlCache[cloudUrl] = tempUrl
          return tempUrl
        } else {
          console.warn('云函数转换URL失败:', cloudUrl, res.result)
        }
      } catch (err) {
        console.error('调用云函数转换URL失败:', err)
      }
      return cloudUrl
    })()
    
    this._convertingUrls.set(cloudUrl, convertPromise)
    
    try {
      const result = await convertPromise
      return result
    } finally {
      this._convertingUrls.delete(cloudUrl)
    }
  },

  async batchConvertUrlsViaCloudFunction(urls) {
    const cloudUrls = urls.filter(url => this.isCloudUrl(url) && !this._urlCache[url])
    
    if (cloudUrls.length === 0) return {}
    
    const uniqueUrls = [...new Set(cloudUrls)]
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'convertTempUrl',
        data: {
          fileList: uniqueUrls
        }
      })
      
      if (res.result && res.result.success && res.result.urlMap) {
        Object.keys(res.result.urlMap).forEach(key => {
          this._urlCache[key] = res.result.urlMap[key]
        })
        return res.result.urlMap
      }
    } catch (err) {
      console.error('批量转换云存储URL失败:', err)
    }
    
    return {}
  },

  async processMessagesUrls(messages) {
    if (!messages || messages.length === 0) return messages
    
    const urlsToConvert = []
    
    messages.forEach(msg => {
      if (msg.recalled) return
      
      if (msg.type === 'image' && this.isCloudUrl(msg.content)) {
        urlsToConvert.push(msg.content)
      }
      if (msg.senderInfo?.avatarUrl && this.isCloudUrl(msg.senderInfo.avatarUrl)) {
        urlsToConvert.push(msg.senderInfo.avatarUrl)
      }
    })
    
    if (urlsToConvert.length > 0) {
      await this.batchConvertUrlsViaCloudFunction(urlsToConvert)
    }
    
    const processedMessages = messages.map(msg => {
      if (msg.recalled) return msg
      
      const newMsg = { ...msg }
      
      if (msg.type === 'image' && msg.content) {
        if (this._urlCache[msg.content]) {
          newMsg.originalCloudUrl = msg.content
          newMsg.content = this._urlCache[msg.content]
        } else if (this.isCloudUrl(msg.content)) {
          newMsg.originalCloudUrl = msg.content
        }
      }
      
      if (msg.senderInfo) {
        const avatarUrl = msg.senderInfo.avatarUrl
        
        if (this.isInvalidLocalUrl(avatarUrl)) {
          newMsg.senderInfo = {
            ...msg.senderInfo,
            avatarUrl: this.data.defaultAvatar
          }
        } else if (this._urlCache[avatarUrl]) {
          newMsg.senderInfo = {
            ...msg.senderInfo,
            avatarUrl: this._urlCache[avatarUrl]
          }
        } else if (this.isCloudUrl(avatarUrl)) {
          newMsg.senderInfo = {
            ...msg.senderInfo,
            avatarUrl: this.data.defaultAvatar
          }
        }
      }
      
      return newMsg
    })
    
    this.updateImageList(processedMessages)
    
    return processedMessages
  },

  updateImageList(messages) {
    this.imageList = []
    messages.forEach(msg => {
      if (msg.type === 'image' && msg.content && !msg.recalled) {
        if (!this.isCloudUrl(msg.content) && !this.imageList.includes(msg.content)) {
          this.imageList.push(msg.content)
        }
      }
    })
  },

  async loadMessages(loadMore = false) {
    if (this.data.loading) return
    if (loadMore && !this.data.hasMore) return

    this.setData({ 
      loading: true,
      loadingMore: loadMore 
    })

    try {
      const lastMessage = loadMore ? this.data.messageList[0] : null
      
      const res = await wx.cloud.callFunction({
        name: 'getMessages',
        data: {
          chatId: this._chatId,
          lastMessageTime: lastMessage ? lastMessage.createTime : null,
          pageSize: this.data.pageSize
        }
      })

      if (res.result && res.result.success) {
        let messages = res.result.data || []
        
        const deletedIds = this.data.deletedMessageIds
        if (deletedIds.length > 0) {
          messages = messages.filter(msg => !deletedIds.includes(msg._id))
        }
        
        messages = messages.map(msg => {
          if (msg.senderInfo && this.isInvalidLocalUrl(msg.senderInfo.avatarUrl)) {
            return {
              ...msg,
              senderInfo: {
                ...msg.senderInfo,
                avatarUrl: this.data.defaultAvatar
              }
            }
          }
          return msg
        })
        
        const allMessages = loadMore 
          ? [...messages, ...this.data.messageList]
          : messages
        
        this.updateImageList(allMessages)

        if (loadMore) {
          this.setData({
            messageList: allMessages,
            hasMore: res.result.hasMore,
            loading: false,
            loadingMore: false
          })
        } else {
          this.setData({
            messageList: allMessages,
            hasMore: res.result.hasMore,
            loading: false,
            loadingMore: false
          }, () => {
            this.scrollToBottom(true)
          })
        }
      } else {
        throw new Error(res.result?.error || '加载失败')
      }
    } catch (err) {
      console.error('加载消息失败:', err)
      this.setData({ loading: false, loadingMore: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  loadMoreMessages() {
    if (!this.data.loadingMore) {
      this.loadMessages(true)
    }
  },

  startMessageWatcher() {
    if (!this._chatId || !this._isPageActive) {
      return
    }

    this.closeMessageWatcher()
    
    const watcherId = Date.now()
    this._currentWatcherId = watcherId

    setTimeout(() => {
      if (!this._isPageActive || this._currentWatcherId !== watcherId) {
        return
      }
      
      try {
        const db = wx.cloud.database()
        
        this.messageWatcher = db.collection('messages')
          .where({
            chatId: this._chatId
          })
          .orderBy('createTime', 'asc')
          .watch({
            onChange: (snapshot) => {
              if (!this._isPageActive) {
                this.closeMessageWatcher()
                return
              }
              
              if (snapshot.type === 'init') return
              
              if (snapshot.docChanges && snapshot.docChanges.length > 0) {
                this.handleDocChanges(snapshot.docChanges)
              }
            },
            onError: (err) => {
              console.error('消息监听失败:', err)
              
              if (this._isPageActive && this._chatId) {
                setTimeout(() => {
                  if (this._isPageActive) {
                    this.startMessageWatcher()
                  }
                }, 5000)
              }
            }
          })
      } catch (err) {
        console.error('启动消息监听器失败:', err)
      }
    }, 300)
  },

  async handleDocChanges(docChanges) {
    let needUpdate = false
    let newMessageList = [...this.data.messageList]
    const newMessages = []
    const deletedIds = this.data.deletedMessageIds
    
    for (const change of docChanges) {
      if (change.queueType === 'enqueue') {
        const newMsg = change.doc
        
        if (deletedIds.includes(newMsg._id)) {
          continue
        }
        
        if (newMsg.senderId === this.data.userId) {
          continue
        }
        
        const exists = newMessageList.some(m => m._id === newMsg._id)
        if (!exists) {
          newMessages.push(newMsg)
          needUpdate = true
        }
      }
      
      if (change.queueType === 'update') {
        const updatedMsg = change.doc
        newMessageList = newMessageList.map(msg => {
          if (msg._id === updatedMsg._id) {
            needUpdate = true
            const result = { ...updatedMsg }
            if (msg.type === 'image' && !this.isCloudUrl(msg.content)) {
              result.content = msg.content
            }
            if (msg.originalCloudUrl) {
              result.originalCloudUrl = msg.originalCloudUrl
            }
            if (msg.senderInfo?.avatarUrl && !this.isCloudUrl(msg.senderInfo.avatarUrl) && !this.isInvalidLocalUrl(msg.senderInfo.avatarUrl)) {
              result.senderInfo = {
                ...updatedMsg.senderInfo,
                avatarUrl: msg.senderInfo.avatarUrl
              }
            }
            return result
          }
          return msg
        })
      }
    }
    
    if (newMessages.length > 0) {
      console.log('收到新消息，开始转换URL:', newMessages.length)
      
      const processedNewMessages = await this.processMessagesUrls(newMessages)
      
      newMessageList = [...newMessageList, ...processedNewMessages]
    }
    
    if (needUpdate) {
      this.updateImageList(newMessageList)
      
      this.setData({ messageList: newMessageList }, () => {
        this.scrollToBottom()
      })
    }
  },

  closeMessageWatcher() {
    this._currentWatcherId = null
    
    if (this.messageWatcher) {
      try {
        this.messageWatcher.close()
      } catch (e) {}
      this.messageWatcher = null
    }
  },

  scrollToBottom(immediate = false) {
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer)
    }
    
    const doScroll = () => {
      if (this._isPageActive) {
        this._scrollCount = (this._scrollCount || 0) + 1
        this.setData({
          scrollToMessage: `msg-bottom`
        }, () => {
          setTimeout(() => {
            this.setData({ scrollTop: 999999 })
          }, 50)
        })
      }
    }
    
    if (immediate) {
      setTimeout(doScroll, 300)
    } else {
      this.scrollTimer = setTimeout(doScroll, 100)
    }
  },

  onInput(e) {
    this.setData({
      inputValue: e.detail.value
    })
  },

  async sendTextMessage() {
    const content = this.data.inputValue.trim()
    if (!content) return

    this.setData({ 
      inputValue: '',
      showEmoji: false  // 发送后关闭表情面板
    })
    await this.sendMessage(content, 'text')
  },

  async sendMessage(content, type) {
    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)
    
    this._sendingMessageIds.add(tempId)
    
    const tempMessage = {
      _id: tempId,
      chatId: this._chatId,
      senderId: this.data.userId,
      senderInfo: {
        nickName: this.data.userInfo?.nickName || '我',
        avatarUrl: this.data.userInfo?.avatarUrl || this.data.defaultAvatar
      },
      type,
      content,
      createTime: new Date().toISOString(),
      status: 'sending'
    }

    this.setData({
      messageList: [...this.data.messageList, tempMessage]
    }, () => {
      this.scrollToBottom()
    })

    try {
      const res = await wx.cloud.callFunction({
        name: 'sendMessage',
        data: {
          chatId: this._chatId,
          content,
          type
        }
      })

      if (res.result && res.result.success) {
        let realMessage = {
          ...res.result.message,
          status: 'sent'
        }
        
        if (type === 'image' && realMessage.content && !this.isCloudUrl(realMessage.content)) {
          if (!this.imageList.includes(realMessage.content)) {
            this.imageList.push(realMessage.content)
          }
        }
        
        const list = this.data.messageList.map(msg => {
          if (msg._id === tempId) {
            return realMessage
          }
          return msg
        })
        
        this.setData({ messageList: list })
        this._sendingMessageIds.delete(tempId)
      } else {
        throw new Error(res.result?.error || '发送失败')
      }
    } catch (err) {
      console.error('发送消息失败:', err)
      
      const list = this.data.messageList.map(msg => {
        if (msg._id === tempId) {
          return { ...msg, status: 'failed' }
        }
        return msg
      })
      this.setData({ messageList: list })
      this._sendingMessageIds.delete(tempId)
      
      wx.showToast({ title: err.message || '发送失败', icon: 'none' })
    }
  },

  resendMessage(e) {
    const msg = e.currentTarget.dataset.msg
    
    const list = this.data.messageList.filter(m => m._id !== msg._id)
    this.setData({ messageList: list })

    this.sendMessage(msg.content, msg.type)
  },

  onMessageLongPress(e) {
    const msg = e.currentTarget.dataset.msg
    
    if (msg.recalled) return
    if (msg._id && msg._id.startsWith('temp_')) return

    const touch = e.touches[0]
    
    this.setData({
      selectedMessage: msg,
      showMessageMenu: true,
      menuPosition: {
        x: touch.clientX,
        y: touch.clientY
      }
    })
  },

  hideMessageMenu() {
    this.setData({
      showMessageMenu: false,
      selectedMessage: null
    })
  },

  onMenuMaskTap() {
    this.hideMessageMenu()
  },

  copyMessage() {
    const msg = this.data.selectedMessage
    if (!msg || msg.type !== 'text') {
      wx.showToast({ title: '只能复制文本消息', icon: 'none' })
      this.hideMessageMenu()
      return
    }

    wx.setClipboardData({
      data: msg.content,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' })
      }
    })
    this.hideMessageMenu()
  },

  canRecallMessage(msg) {
    if (msg.senderId !== this.data.userId) return false
    if (msg.recalled) return false
    
    const createTime = new Date(msg.createTime).getTime()
    const now = Date.now()
    return (now - createTime) <= this.data.recallTimeLimit
  },

  async recallMessage() {
    const msg = this.data.selectedMessage
    
    if (!msg) {
      this.hideMessageMenu()
      return
    }

    if (!this.canRecallMessage(msg)) {
      wx.showToast({ title: '超过2分钟无法撤回', icon: 'none' })
      this.hideMessageMenu()
      return
    }

    this.hideMessageMenu()
    wx.showLoading({ title: '撤回中...' })

    try {
      const res = await wx.cloud.callFunction({
        name: 'recallMessage',
        data: {
          messageId: msg._id,
          chatId: this._chatId
        }
      })

      if (res.result && res.result.success) {
        const list = this.data.messageList.map(m => {
          if (m._id === msg._id) {
            return {
              ...m,
              recalled: true,
              originalContent: m.content,
              originalType: m.type
            }
          }
          return m
        })
        this.setData({ messageList: list })
        wx.showToast({ title: '已撤回', icon: 'success' })
      } else {
        throw new Error(res.result?.error || '撤回失败')
      }
    } catch (err) {
      console.error('撤回消息失败:', err)
      wx.showToast({ title: err.message || '撤回失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  deleteMessageLocal() {
    const msg = this.data.selectedMessage
    this.hideMessageMenu()
    
    if (!msg) return

    wx.showModal({
      title: '提示',
      content: '确定删除这条消息吗？（仅本地删除）',
      success: (res) => {
        if (res.confirm) {
          const list = this.data.messageList.filter(m => m._id !== msg._id)
          
          const deletedIds = [...this.data.deletedMessageIds, msg._id]
          
          const deletedKey = `deleted_msgs_${this._chatId}`
          wx.setStorageSync(deletedKey, deletedIds)
          
          this.setData({ 
            messageList: list,
            deletedMessageIds: deletedIds
          })
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  },

  toggleMore() {
    const newShowMore = !this.data.showMore
    this.setData({ 
      showMore: newShowMore,
      showEmoji: false
    }, () => {
      if (newShowMore) {
        this.scrollToBottom()
      }
    })
  },

  toggleEmoji() {
    const newShowEmoji = !this.data.showEmoji
    this.setData({ 
      showEmoji: newShowEmoji,
      showMore: false
    }, () => {
      if (newShowEmoji) {
        this.scrollToBottom()
      }
    })
  },

  toggleVoice() {
    this.setData({ 
      showVoice: !this.data.showVoice,
      showMore: false,
      showEmoji: false
    })
  },

  chooseImage() {
    this.setData({ showMore: false })

    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => {
        res.tempFiles.forEach(file => {
          this.uploadAndSendImage(file.tempFilePath)
        })
      }
    })
  },

  takePhoto() {
    this.setData({ showMore: false })

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: (res) => {
        this.uploadAndSendImage(res.tempFiles[0].tempFilePath)
      }
    })
  },

  async uploadAndSendImage(tempFilePath) {
    wx.showLoading({ title: '发送中...' })

    try {
      const compressRes = await wx.compressImage({
        src: tempFilePath,
        quality: 80
      }).catch(() => ({ tempFilePath }))

      const fileName = `chat/${this._chatId}/${Date.now()}_${Math.random().toString(36).substr(2, 8)}.jpg`
      
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: fileName,
        filePath: compressRes.tempFilePath
      })

      await this.sendMessage(uploadRes.fileID, 'image')
    } catch (err) {
      console.error('发送图片失败:', err)
      wx.showToast({ title: '发送失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async previewImage(e) {
    const msgId = e.currentTarget.dataset.msgid
    
    // 通过消息ID从列表中找到当前消息，直接使用其content（已转换的URL）
    const currentMsg = this.data.messageList.find(m => m._id === msgId)
    if (!currentMsg || !currentMsg.content) return
    
    let currentUrl = currentMsg.content
    
    // 如果还是云存储URL（转换失败的情况），尝试再次转换
    if (this.isCloudUrl(currentUrl)) {
      wx.showLoading({ title: '加载中...' })
      try {
        currentUrl = await this.convertUrlViaCloudFunction(currentUrl)
      } finally {
        wx.hideLoading()
      }
    }
    
    // 从 messageList 构建图片列表，确保与 current 使用同一数据源
    const validUrls = []
    let currentIndex = -1
    
    this.data.messageList.forEach(msg => {
      if (msg.type === 'image' && msg.content && !msg.recalled && !this.isCloudUrl(msg.content)) {
        if (msg._id === msgId) {
          currentIndex = validUrls.length
        }
        validUrls.push(msg.content)
      }
    })
    
    // 如果当前URL不在列表中（刚转换成功的情况），插入到正确位置
    if (currentIndex === -1 && currentUrl && !this.isCloudUrl(currentUrl)) {
      // 计算应该插入的位置
      let insertIndex = 0
      for (const msg of this.data.messageList) {
        if (msg._id === msgId) break
        if (msg.type === 'image' && msg.content && !msg.recalled && !this.isCloudUrl(msg.content)) {
          insertIndex++
        }
      }
      validUrls.splice(insertIndex, 0, currentUrl)
      currentIndex = insertIndex
    }
    
    // 使用列表中的URL作为current，确保精确匹配
    const finalCurrentUrl = currentIndex >= 0 ? validUrls[currentIndex] : currentUrl
    
    wx.previewImage({
      current: finalCurrentUrl,
      urls: validUrls.length > 0 ? validUrls : [currentUrl]
    })
  },

  onKeyboardHeightChange(e) {
    this.setData({
      keyboardHeight: e.detail.height
    })
    
    if (e.detail.height > 0) {
      // 键盘弹出时关闭表情和更多面板
      this.setData({
        showEmoji: false,
        showMore: false
      })
      this.scrollToBottom()
    }
  },

  // 输入框获取焦点
  onInputFocus() {
    this.setData({
      inputFocus: true,
      showEmoji: false,
      showMore: false
    })
  },

  // 输入框失去焦点
  onInputBlur() {
    this.setData({
      inputFocus: false
    })
  }
})