import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosRequestHeaders, AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'
import commonStorage from './commonStorage'

interface AppAxiosRequestConfig<D = any> extends AxiosRequestConfig<D> {
  rawResponse?: boolean
}

interface RequestApi {
  <T = any>(config: AppAxiosRequestConfig): Promise<T>
  get<T = any>(url: string, config?: AppAxiosRequestConfig): Promise<T>
  post<T = any>(url: string, data?: any, config?: AppAxiosRequestConfig): Promise<T>
  put<T = any>(url: string, data?: any, config?: AppAxiosRequestConfig): Promise<T>
  delete<T = any>(url: string, config?: AppAxiosRequestConfig): Promise<T>
  raw<T = any>(config: AppAxiosRequestConfig): Promise<AxiosResponse<T>>
}


const instance: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL || '/api',
  timeout: 10000
})

instance.interceptors.request.use(
  (config) => {
    const token = commonStorage.get('token')
    if (token) {
      (config.headers as AxiosRequestHeaders).Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

instance.interceptors.response.use(
  (response) => {
    if ((response.config as AppAxiosRequestConfig).rawResponse) {
      return response
    }
    return response.data
  },
  (error) => {
    console.log('request.ts error:', error.response)
    const code = error.response?.status
    if (code === 400) {
      ElMessage.error('请求参数错误')
    }
    return Promise.reject(error)
  }
)

export const request = (<T = any>(config: AppAxiosRequestConfig): Promise<T> => {
  return instance.request(config)
}) as RequestApi

request.raw = <T = any>(config: AppAxiosRequestConfig): Promise<AxiosResponse<T>> => {
  const rawConfig = {
    ...config,
    rawResponse: true
  } as AppAxiosRequestConfig

  return instance.request(rawConfig as AxiosRequestConfig) as Promise<AxiosResponse<T>>
}


request.get = <T = any>(url: string, config?: AppAxiosRequestConfig): Promise<T> => {
  return instance.get(url, config)
}

request.post = <T = any>(url: string, data?: any, config?: AppAxiosRequestConfig): Promise<T> => {
  return instance.post(url, data, config)
}

request.put = <T = any>(url: string, data?: any, config?: AppAxiosRequestConfig): Promise<T> => {
  return instance.put(url, data, config)
}

request.delete = <T = any>(url: string, config?: AppAxiosRequestConfig): Promise<T> => {
  return instance.delete(url, config)
}
