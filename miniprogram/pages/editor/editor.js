const api = require('../../utils/api');
const CATEGORIES = ['海鲜', '肉菜', '素菜', '主食', '汤品', '甜品', '火锅', '其他'];

Page({
  data: {
    id: '', name: '', category: '肉菜', categoryIndex: 1, ingredientsText: '', description: '',
    categories: CATEGORIES, image: '', filePath: '', submitting: false, editing: false
  },
  onLoad(options) {
    if (!api.isAdmin()) return wx.redirectTo({ url: '/pages/login/login?next=editor' });
    if (!options.id) return;
    const dish = getApp().globalData.dishes.find((item) => item.id === options.id);
    if (!dish) return;
    const categoryIndex = Math.max(0, CATEGORIES.indexOf(dish.category));
    this.setData({ id: dish.id, name: dish.name, category: dish.category, categoryIndex, ingredientsText: dish.ingredients.join('、'), description: dish.description, image: dish.image, editing: true });
    wx.setNavigationBarTitle({ title: '修改菜谱' });
  },
  chooseImage() {
    wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], success: (result) => this.setData({ filePath: result.tempFiles[0].tempFilePath, image: result.tempFiles[0].tempFilePath }) });
  },
  setName(event) { this.setData({ name: event.detail.value }); },
  setIngredients(event) { this.setData({ ingredientsText: event.detail.value }); },
  setDescription(event) { this.setData({ description: event.detail.value }); },
  setCategory(event) { const categoryIndex = Number(event.detail.value); this.setData({ categoryIndex, category: CATEGORIES[categoryIndex] }); },
  splitIngredients() { return [...new Set(this.data.ingredientsText.split(/[\s，,、；;]+/).map((item) => item.trim()).filter(Boolean))]; },
  async submit() {
    const ingredients = this.splitIngredients();
    if (!this.data.name.trim() || !ingredients.length) return wx.showToast({ title: '请填写菜名和食材', icon: 'none' });
    this.setData({ submitting: true });
    wx.showLoading({ title: '正在保存' });
    try {
      const dish = await api.save({ id: this.data.id, name: this.data.name.trim(), category: this.data.category, ingredients, description: this.data.description.trim() }, this.data.filePath);
      const app = getApp();
      const exists = app.globalData.dishes.some((item) => item.id === dish.id);
      app.globalData.dishes = exists ? app.globalData.dishes.map((item) => item.id === dish.id ? dish : item) : [...app.globalData.dishes, dish];
      app.globalData.menuUpdatedAt = Date.now();
      wx.showToast({ title: '已同步到所有设备' });
      setTimeout(() => wx.redirectTo({ url: `/pages/detail/detail?id=${dish.id}` }), 450);
    } catch (error) {
      if (!api.isAdmin()) setTimeout(() => wx.redirectTo({ url: '/pages/login/login?next=editor' }), 500);
      wx.showToast({ title: error.message, icon: 'none' });
    } finally { wx.hideLoading(); this.setData({ submitting: false }); }
  }
});
