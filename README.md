# Awaken

## todo

异常处理，超时等
搜索功能

导入笔记merge的那一步有问题，去重失败

展示笔记太长时用...
看笔记导入的时候能不能解析页数  
笔记和书签展示为 页数/总页数  
页数按照600字生成  
书签存cfi而不是页数

安卓和windows端，无法跳转link标注
iOS无法打开新窗口
移动端，默认选择文本后的行为

记录的page下次进入，有时候无效
点击跳转后，可能page进度没同步

合并笔记如无修改不要更新到远端

导入笔记的时候如果有同名、同作者笔记html文件，则同步导入
已导入的也能支持导入

第一次同步到本地时，没有封面

hack `book.locations.generate`，让其可以返回generate的进度，超级麻烦，有空再看吧

自定义样式：
各种样式配色

例子多放几本书，各种不同的观点，多元文化主义，自由论，乡土中国，局外人，喧哗与骚动


性能问题，一开始用另一个`json`将所有分页缓存，仅仅存于本地，不同步到远端 解决  
基于WebDAV，支持添加和删除书籍书籍，书籍内支持进度、书签、标注和笔记，均支持多端同步。

多端，桌面（Windows、macOS、Linux），移动端（安卓、iOS）。

A cross-platform ebooks reader, supports win/android/mac/ios/linux, use wevdav to sync progress, hightlights and annotations.

## Copyright
**Copyright © 2022, 戴天宇, Tianyu Dai (dtysky < dtysky@outlook.com >). All Rights Reserved.**  
**This project is free software and released under the** [GNU Lesser General Public License (LGPL)](https://www.gnu.org/licenses/lgpl-3.0.en.html).**
