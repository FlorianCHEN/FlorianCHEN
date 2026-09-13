const api = require('../../utils/api');
const NON_LINKED = new Set(['蒜', '葱', '姜', '黑胡椒', '糖', '醋', '孜然', '咖喱', '可乐', '茶叶', '迷迭香']);

Page({
  data: { dish: null, ingredients: [], isAdmin: false, loading: true },
  onLoad(options) { this.id = options.id; this.loadDish(); },
  onShow() {
    this.setData({ isAdmin: api.isAdmin() });
    if (this.loaded) this.loadDish();
  },
  async loadDish() {
    let dishes = getApp().globalData.dishes;
    if (!dishes.length || !dishes.some((dish) => dish.id === this.id)) {
      try { dishes = await api.list(); getApp().globalData.dishes = dishes; } catch (error) { wx.showToast({ title: error.message, icon: 'none' }); }
    }
    const dish = dishes.find((item) => item.id === this.id);
    if (!dish) return this.setData({ loading: false });
    const ingredients = dish.ingredients.map((name) => ({ name, linked: !NON_LINKED.has(name) }));
    this.loaded = true;
    this.setData({ dish, ingredients, loading: false });
    wx.setNavigationBarTitle({ title: dish.name });
  },
  openRelated(event) {
    if (!event.currentTarget.dataset.linked) return;
    wx.navigateTo({ url: `/pages/related/related?ingredient=${encodeURIComponent(event.currentTarget.dataset.name)}` });
  },
  editDish() { wx.navigateTo({ url: `/pages/editor/editor?id=${this.id}` }); },
  replaceImage() {
    wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], success: async (result) => {
      wx.showLoading({ title: '正在上传' });
      try {
        const dish = await api.save(this.data.dish, result.tempFiles[0].tempFilePath);
        this.updateDish(dish);
        wx.showToast({ title: '图片已同步' });
      } catch (error) { wx.showToast({ title: error.message, icon: 'none' }); }
      finally { wx.hideLoading(); }
    }});
  },
  async restoreImage() {
    wx.showLoading({ title: '正在恢复' });
    try { this.updateDish(await api.restore(this.id)); wx.showToast({ title: '已恢复原图' }); }
    catch (error) { wx.showToast({ title: error.message, icon: 'none' }); }
    finally { wx.hideLoading(); }
  },
  deleteDish() {
    wx.showModal({ title: '删除菜品', content: `确定删除「${this.data.dish.name}」？`, confirmColor: '#6b2730', success: async (result) => {
      if (!result.confirm) return;
      try {
        await api.remove(this.id);
        const app = getApp();
        app.globalData.dishes = app.globalData.dishes.filter((dish) => dish.id !== this.id);
        app.globalData.menuUpdatedAt = Date.now();
        wx.navigateBack();
      } catch (error) { wx.showToast({ title: error.message, icon: 'none' }); }
    }});
  },
  updateDish(dish) {
    const app = getApp();
    app.globalData.dishes = app.globalData.dishes.map((item) => item.id === dish.id ? dish : item);
    app.globalData.menuUpdatedAt = Date.now();
    this.setData({ dish });
  }
});
