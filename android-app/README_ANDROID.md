# 安卓 App 打包说明

这个目录是“物品库存”的 Android App 工程。它用原生 WebView 加载本地网页资源，不需要服务器，库存、照片和备份数据保存在手机本地。

## 准备

安装 Android Studio：

https://developer.android.com/studio

安装时使用默认选项即可，确保包含 Android SDK。

## 打开项目

1. 打开 Android Studio
2. 选择 `Open`
3. 选择本目录：`android-app`
4. 等待 Gradle Sync 完成

第一次打开会下载 Android Gradle Plugin 和依赖，可能需要几分钟。

## 生成 APK

在 Android Studio 菜单选择：

`Build` -> `Build Bundle(s) / APK(s)` -> `Build APK(s)`

生成完成后，Android Studio 右下角会出现提示，点击 `locate` 可以找到 APK。常见路径是：

`android-app/app/build/outputs/apk/debug/app-debug.apk`

## 安装到手机

把 `app-debug.apk` 发到安卓手机上，点击安装。如果系统提示“未知来源应用”，按提示允许当前文件管理器或浏览器安装即可。

## 数据说明

- 数据保存在 App 的本地 WebView 存储里
- 照片会压缩后保存在本地数据中
- 换手机、卸载 App、清除应用数据前，请先在 App 里点“备份”导出 JSON

## 修改网页后同步到 App

如果修改了根目录下的网页文件，需要重新复制到：

`android-app/app/src/main/assets`

需要同步的文件包括：

- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `icon.svg`
