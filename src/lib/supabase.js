import { createClient } from '@supabase/supabase-js'

let cachedClient = null
let cachedUrl = ''
let cachedKey = ''

export function normalizeUrl(url) {
  return url.replace(/\/rest\/v1\/?$/, '').replace(/\|$/, '').replace(/\/+$/, '')
}

export function getSupabase(url, key) {
  const cleanUrl = normalizeUrl(url)
  if (!cleanUrl || !key) return null
  if (!cachedClient || cachedUrl !== cleanUrl || cachedKey !== key) {
    cachedClient = createClient(cleanUrl, key)
    cachedUrl = cleanUrl
    cachedKey = key
  }
  return cachedClient
}

export function getDeviceId() {
  let id = localStorage.getItem('device_id')
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10)
    localStorage.setItem('device_id', id)
  }
  return id
}

export function getDeviceName() {
  return localStorage.getItem('device_name') || ''
}

export function setDeviceName(name) {
  localStorage.setItem('device_name', name)
}

export function getSupabaseCredentials() {
  return {
    url: localStorage.getItem('supabase_url') || '',
    key: localStorage.getItem('supabase_anon_key') || '',
  }
}
