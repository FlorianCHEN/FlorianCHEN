const api = require('../../utils/api');

Page({
  data: { username: '', password: '', submitting: false },
  onLoad(options) { this.next = options.next || ''; },
  setUsername(event) { this.setData({ username: event.detail.value }); },
  setPassword(event) { this.setData({ password: event.detail.value }); },
  async submit() {
    if (!this.data.username.trim() || !this.data.password) return wx.showToast({ title: '请输入账号和密码', icon: 'none' });
    this.setData({ submitting: true });
    try {
      await api.login(this.data.username.trim(), this.data.password);
      if (this.next === 'editor') return wx.redirectTo({ url: '/pages/editor/editor' });
      wx.navigateBack();
    } catch (error) { wx.showToast({ title: error.message, icon: 'none' }); }
    finally { this.setData({ submitting: false }); }
  }
});
