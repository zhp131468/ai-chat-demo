/*
 * @Author: zhp131468 249799138@qq.com
 * @Date: 2026-05-13 12:20:47
 * @LastEditors: zhp131468 249799138@qq.com
 * @LastEditTime: 2026-05-13 12:27:02
 * @Description: 封装 localStorage 操作方法
 * @FilePath: \vite+ts\src\utils\commonStorage.ts
 */
class CommonLocalStorage {
  private storage: Storage;
  /**
   * 构造函数：初始化 localStorage 实例
   * @description 创建 CommonLocalStorage 实例时，自动获取 window.localStorage 引用
   */
  constructor() {
    this.storage = window.localStorage;
  }
  /**
   * 存储数据到 localStorage
   * @template T - 存储数据的类型
   * @param {string} key - 存储键名
   * @param {T} value - 要存储的数据（支持任意类型，会自动序列化为 JSON）
   * @returns {void}
   */
  set<T>(key: string, value: T): void {
    try {
      // 将任意类型序列化为 JSON 字符串存储
      const serializedValue = JSON.stringify(value);
      this.storage.setItem(key, serializedValue);
    } catch (error) {
      console.error('Storage set error:', error);
    }
  }
  /**
   * 从 localStorage 获取数据
   * @template T - 返回数据的类型
   * @param {string} key - 存储键名
   * @returns {T | null} - 返回指定类型的数据，如果键不存在则返回 null
   */
  get<T>(key: string): T | null {
    try {
      const item = this.storage.getItem(key);
      if (item === null) return null;
      // 反序列化回原始类型
      return JSON.parse(item) as T;
    } catch (error) {
      console.error('Storage get error:', error);
      return null;
    }
  }
  /**
   * 从 localStorage 删除指定键的数据
   * @param {string} key - 要删除的键名
   * @returns {void}
   */
  del(key: string): void {
    return this.storage.removeItem(`${key}`);
  }
  /**
   * 清空 localStorage 中的所有数据
   * @description 此操作会删除所有存储的数据，且无法恢复，请谨慎使用
   * @returns {void}
   */
  clear(): void {
    return this.storage.clear();
  }
}
const commonStorage = new CommonLocalStorage();
export default commonStorage;