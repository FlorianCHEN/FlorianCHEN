const api = require('../../utils/api');
const PAGE_SIZE = 14;
const CATEGORY_ORDER = ['全部', '海鲜', '肉菜', '素菜', '主食', '汤品', '甜品', '火锅', '其他'];

Page({
  data: {
    dishes: [],
    visible: [],
    categories: ['全部'],
    category: '全部',
    query: '',
    page: 1,
    totalPages: 1,
    loading: true,
    error: '',
    drawerOpen: false,
    isAdmin: false
  },

  onLoad() { this.loadMenu(); },
  onShow() {
    this.setData({ isAdmin: api.isAdmin() });
    const app = getApp();
    if (app.globalData.menuUpdatedAt > (this.lastLoadedAt || 0)) this.loadMenu();
  },
  onPullDownRefresh() { this.loadMenu(true); },

  async loadMenu(fromPull = false) {
    if (!fromPull) this.setData({ loading: true, error: '' });
    try {
      const dishes = await api.list();
      const used = new Set(dishes.map((dish) => dish.category));
      const categories = CATEGORY_ORDER.filter((category) => category === '全部' || used.has(category));
      getApp().globalData.dishes = dishes;
      this.lastLoadedAt = Date.now();
      this.setData({ dishes, categories, loading: false, error: '' }, () => this.applyFilters());
    } catch (error) {
      this.setData({ loading: false, error: error.message || '菜单加载失败' });
    } finally {
      if (fromPull) wx.stopPullDownRefresh();
    }
  },

  applyFilters(resetPage = false) {
    const query = this.data.query.trim();
    const filtered = this.data.dishes.filter((dish) =>
      (this.data.category === '全部' || dish.category === this.data.category) &&
      (!query || dish.name.includes(query) || dish.ingredients.some((item) => item.includes(query)))
    );
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const page = resetPage ? 1 : Math.min(this.data.page, totalPages);
    const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    this.setData({ visible, page, totalPages });
  },

  onSearch(event) { this.setData({ query: event.detail.value }, () => this.applyFilters(true)); },
  retryLoad() { this.loadMenu(); },
  clearSearch() { this.setData({ query: '', category: '全部' }, () => this.applyFilters(true)); },
  chooseCategory(event) {
    this.setData({ category: event.currentTarget.dataset.category, drawerOpen: false }, () => this.applyFilters(true));
  },
  previousPage() {
    if (this.data.page <= 1) return;
    this.setData({ page: this.data.page - 1 }, () => { this.applyFilters(); wx.pageScrollTo({ scrollTop: 0, duration: 220 }); });
  },
  nextPage() {
    if (this.data.page >= this.data.totalPages) return;
    this.setData({ page: this.data.page + 1 }, () => { this.applyFilters(); wx.pageScrollTo({ scrollTop: 0, duration: 220 }); });
  },
  toggleDrawer() { this.setData({ drawerOpen: !this.data.drawerOpen }); },
  noop() {},
  closeDrawer() { this.setData({ drawerOpen: false }); },
  openDish(event) { wx.navigateTo({ url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}` }); },
  openEditor() {
    this.setData({ drawerOpen: false });
    wx.navigateTo({ url: api.isAdmin() ? '/pages/editor/editor' : '/pages/login/login?next=editor' });
  },
  openLogin() { this.setData({ drawerOpen: false }); wx.navigateTo({ url: '/pages/login/login' }); },
  logout() { api.logout(); this.setData({ drawerOpen: false, isAdmin: false }); }
});
