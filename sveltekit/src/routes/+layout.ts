/**
 * 全站尾斜杠规范：'always'
 *
 * 这样 /blog/x 会 308 到 /blog/x/，与 canonical、sitemap、内部链接
 * 全部一致——避免「canonical 指向一个重定向地址」这种典型 SEO 缺陷。
 * 放在根 +layout.ts，对所有子路由生效。
 */
export const trailingSlash = 'always'
