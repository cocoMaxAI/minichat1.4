Component({
    properties: {
      // 列表数据
      list: {
        type: Array,
        value: []
      },
      // 每项高度（估算）
      itemHeight: {
        type: Number,
        value: 100
      },
      // 缓冲区数量
      bufferSize: {
        type: Number,
        value: 5
      }
    },
  
    data: {
      visibleList: [],
      startIndex: 0,
      endIndex: 0,
      offsetY: 0,
      containerHeight: 0,
      totalHeight: 0
    },
  
    lifetimes: {
      attached() {
        this.initContainer()
      }
    },
  
    observers: {
      'list': function(list) {
        this.updateTotalHeight()
        this.updateVisibleList()
      }
    },
  
    methods: {
      // 初始化容器高度
      initContainer() {
        const query = this.createSelectorQuery()
        query.select('.virtual-container').boundingClientRect((rect) => {
          if (rect) {
            this.setData({
              containerHeight: rect.height
            })
            this.updateVisibleList()
          }
        }).exec()
      },
  
      // 更新总高度
      updateTotalHeight() {
        const totalHeight = this.data.list.length * this.data.itemHeight
        this.setData({ totalHeight })
      },
  
      // 更新可见列表
      updateVisibleList(scrollTop = 0) {
        const { list, itemHeight, bufferSize, containerHeight } = this.data
        
        if (!list.length || !containerHeight) return
  
        // 计算可见区域的起始和结束索引
        const visibleCount = Math.ceil(containerHeight / itemHeight)
        let startIndex = Math.floor(scrollTop / itemHeight)
        let endIndex = startIndex + visibleCount
  
        // 添加缓冲区
        startIndex = Math.max(0, startIndex - bufferSize)
        endIndex = Math.min(list.length - 1, endIndex + bufferSize)
  
        // 获取可见列表
        const visibleList = list.slice(startIndex, endIndex + 1).map((item, index) => ({
          ...item,
          _virtualIndex: startIndex + index
        }))
  
        // 计算偏移量
        const offsetY = startIndex * itemHeight
  
        this.setData({
          visibleList,
          startIndex,
          endIndex,
          offsetY
        })
      },
  
      // 滚动事件处理
      onScroll(e) {
        const scrollTop = e.detail.scrollTop
        this.updateVisibleList(scrollTop)
        
        // 触发父组件事件
        this.triggerEvent('scroll', e.detail)
      },
  
      // 滚动到底部事件
      onScrollToLower(e) {
        this.triggerEvent('scrolltolower', e.detail)
      },
  
      // 滚动到顶部事件
      onScrollToUpper(e) {
        this.triggerEvent('scrolltoupper', e.detail)
      }
    }
  })