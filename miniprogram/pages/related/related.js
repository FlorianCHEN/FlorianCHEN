const api = require('../../utils/api');

Page({
  data: { ingredient: '', dishes: [], loading: true },
  onLoad(options) {
    const ingredient = decodeURIComponent(options.ingredient || '');
    this.setData({ ingredient });
    wx.setNavigationBarTitle({ title: ingredient || '相关菜谱' });
    this.loadDishes();
  },
  async loadDishes() {
    let dishes = getApp().globalData.dishes;
    if (!dishes.length) {
      try { dishes = await api.list(); getApp().globalData.dishes = dishes; }
      catch (error) { wx.showToast({ title: error.message, icon: 'none' }); }
    }
    this.setData({ dishes: dishes.filter((dish) => dish.ingredients.includes(this.data.ingredient)), loading: false });
  },
  openDish(event) { wx.navigateTo({ url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}` }); }
});
