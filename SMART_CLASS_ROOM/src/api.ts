import { auth } from './firebase';

const API_BASE = '/api';

const getHeaders = async () => {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

export const api = {
  admin: {
    getStaff: async () => fetch(`${API_BASE}/admin/staff`, { headers: await getHeaders() }).then(res => res.json()),
    deleteStaff: async (id: string) => fetch(`${API_BASE}/admin/staff/${id}`, { method: 'DELETE', headers: await getHeaders() }).then(res => res.json()),
    getStudents: async () => fetch(`${API_BASE}/admin/students`, { headers: await getHeaders() }).then(res => res.json()),
    deleteStudent: async (id: string) => fetch(`${API_BASE}/admin/students/${id}`, { method: 'DELETE', headers: await getHeaders() }).then(res => res.json()),
  },
  staff: {
    uploadMaterial: async (formData: FormData) => {
      const headers = await getHeaders();
      delete (headers as any)['Content-Type']; // Let browser set boundary for multipart/form-data
      return fetch(`${API_BASE}/staff/materials`, {
        method: 'POST',
        headers: headers,
        body: formData,
      }).then(res => res.json());
    },
    getMaterials: async () => fetch(`${API_BASE}/staff/materials`, { headers: await getHeaders() }).then(res => res.json()),
    getProgress: async () => fetch(`${API_BASE}/staff/progress`, { headers: await getHeaders() }).then(res => res.json()),
    getQuestions: async () => fetch(`${API_BASE}/staff/questions`, { headers: await getHeaders() }).then(res => res.json()),
    saveQuestions: async (data: any) => {
      const res = await fetch(`${API_BASE}/staff/questions`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { error: body?.error || 'Failed to save questions' };
      return body;
    },
  },
  student: {
    getMaterials: async () => fetch(`${API_BASE}/student/materials`, { headers: await getHeaders() }).then(res => res.json()),
    logAccess: async (id: number) => fetch(`${API_BASE}/student/materials/${id}/access`, { method: 'POST', headers: await getHeaders() }).then(res => res.json()),
    downloadMaterial: async (id: number) => {
      const res = await fetch(`${API_BASE}/student/materials/${id}/download`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to download material');
      return res.blob();
    },
    getQuestions: async () => fetch(`${API_BASE}/student/questions`, { headers: await getHeaders() }).then(res => res.json()),
    submitAnswer: async (data: any) => fetch(`${API_BASE}/student/submit-answer`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(data),
    }).then(res => res.json()),
    chatbotAsk: async (message: string, history: Array<{ role: 'user' | 'assistant'; content: string }>) => {
      const res = await fetch(`${API_BASE}/student/chatbot`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ message, history }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { error: body?.error || 'Chatbot request failed' };
      return body;
    },
    getProgress: async () => fetch(`${API_BASE}/student/progress`, { headers: await getHeaders() }).then(res => res.json()),
  }
};
