# 開開厨房微信小程序

这是与网页版共用同一套云端菜单数据的原生微信小程序版本。

## 在微信开发者工具中打开

1. 选择“导入项目”。
2. 项目目录选择本仓库的 `miniprogram` 文件夹。
3. 开发阶段可以先使用测试号；正式发布前，把 `project.config.json` 中的 `appid` 换成自己的小程序 AppID。
4. 开发调试时，如尚未配置服务器域名，可在“详情 → 本地设置”中临时勾选“不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书”。这一选项仅用于本机调试。

## 正式发布前

在微信公众平台的小程序后台，将以下地址加入服务器域名：

- request 合法域名：`https://vqgpbepmuteoszdagxjl.supabase.co`
- uploadFile 合法域名：`https://vqgpbepmuteoszdagxjl.supabase.co`
- downloadFile 合法域名：`https://vqgpbepmuteoszdagxjl.supabase.co`

如果该域名不能通过正式环境校验，需要配置一个符合微信要求的自有 API 域名作为代理，菜单数据仍可保留在现有云端数据库中。
