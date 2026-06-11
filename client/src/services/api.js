// import axios from 'axios'

// const api = axios.create({
//   baseURL: '',           // ← Empty — proxy use karega
//   withCredentials: true,
// })

// export const getAuthUrl = () => api.get('/api/auth/url')
// export const checkAuth = () => api.get('/api/auth/check')
// export const logout = () => api.post('/api/auth/logout')
// export const getAPOverpayments = () => api.get('/api/allocation/overpayment/ap')
// export const getAROverpayments = () => api.get('/api/allocation/overpayment/ar')

// export const exportAPOverpayments = () =>
//   api.get('/api/allocation/overpayment/ap/export', { responseType: 'blob' })
// export const exportAROverpayments = () =>
//   api.get('/api/allocation/overpayment/ar/export', { responseType: 'blob' })

// export const getInvoiceAllocations = () => api.get('/api/allocation/invoice')
// export const exportInvoiceAllocations = () =>
//   api.get('/api/allocation/invoice/export', { responseType: 'blob' })

// export const getBillAllocations = () => api.get('/api/allocation/bill')
// export const exportBillAllocations = () =>
//   api.get('/api/allocation/bill/export', { responseType: 'blob' })

// export const getOverpayments = () => api.get('/api/allocation/overpayment')










import axios from 'axios'

const api = axios.create({
  baseURL: '',
  withCredentials: true,
})

export const getAuthUrl = () => api.get('/api/auth/url')
export const checkAuth = () => api.get('/api/auth/check')
export const logout = () => api.post('/api/auth/logout')

// ── Date params ke saath ──
export const getInvoiceAllocations = (startDate, endDate) =>
  api.get('/api/allocation/invoice', { params: { startDate, endDate } })
export const exportInvoiceAllocations = (startDate, endDate) =>
  api.get('/api/allocation/invoice/export', { params: { startDate, endDate }, responseType: 'blob' })

export const getBillAllocations = (startDate, endDate) =>
  api.get('/api/allocation/bill', { params: { startDate, endDate } })
export const exportBillAllocations = (startDate, endDate) =>
  api.get('/api/allocation/bill/export', { params: { startDate, endDate }, responseType: 'blob' })

export const getAPOverpayments = (startDate, endDate) =>
  api.get('/api/allocation/overpayment/ap', { params: { startDate, endDate } })
export const exportAPOverpayments = (startDate, endDate) =>
  api.get('/api/allocation/overpayment/ap/export', { params: { startDate, endDate }, responseType: 'blob' })

export const getAROverpayments = (startDate, endDate) =>
  api.get('/api/allocation/overpayment/ar', { params: { startDate, endDate } })
export const exportAROverpayments = (startDate, endDate) =>
  api.get('/api/allocation/overpayment/ar/export', { params: { startDate, endDate }, responseType: 'blob' })

export const getOverpayments = () => api.get('/api/allocation/overpayment')