Component({
    properties: {
      src: {
        type: String,
        value: ''
      },
      mode: {
        type: String,
        value: 'aspectFill'
      },
      placeholder: {
        type: String,
        value: '/images/placeholder.png'
      }
    },
  
    data: {
      loaded: false,
      error: false,
      realSrc: ''
    },
  
    lifetimes: {
      attached() {
        this.observer = null
        this.initObserver()
      },
  
      detached() {
        if (this.observer) {
          this.observer.disconnect()
        }
      }
    },
  
    methods: {
      initObserver() {
        // 使用 IntersectionObserver 实现懒加载
        this.observer = this.createIntersectionObserver()
        this.observer.relativeToViewport({ bottom: 100, top: 100 })
          .observe('.lazy-image', (res) => {
            if (res.intersectionRatio > 0 && !this.data.loaded) {
              this.setData({
                realSrc: this.data.src
              })
              this.observer.disconnect()
            }
          })
      },
  
      onLoad() {
        this.setData({ loaded: true })
        this.triggerEvent('load')
      },
  
      onError() {
        this.setData({ 
          error: true,
          realSrc: this.data.placeholder
        })
        this.triggerEvent('error')
      }
    }
  })