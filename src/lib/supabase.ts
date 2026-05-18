import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, key)

export type Resource = {
  id: string
  name: string
  type: string
  state: string
  county: string
  city: string
  phone: string
  address: string
  notes: string
  pinned: boolean
  created_at: string
  updated_at: string
  updated_by: string
}

export type Hotline = {
  id: string
  name: string
  phone: string
  state: string
  category: string
  notes: string
}

export type Suggestion = {
  id: string
  name: string
  type: string
  state: string
  county: string
  city: string
  phone: string
  address: string
  notes: string
  submitted_at: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string
  reviewed_at: string
}

export const TYPE_META: Record<string, { icon: string; accent: string; badge: string }> = {
  Emergency:      { icon: '🚨', accent: '#DC2626', badge: 'bg-red-100 text-red-800' },
  Food:           { icon: '🍎', accent: '#16A34A', badge: 'bg-green-100 text-green-800' },
  Housing:        { icon: '🏠', accent: '#2563EB', badge: 'bg-blue-100 text-blue-800' },
  Veteran:        { icon: '🎖️', accent: '#7C3AED', badge: 'bg-purple-100 text-purple-800' },
  Community:      { icon: '🤝', accent: '#B45309', badge: 'bg-yellow-100 text-yellow-800' },
  Assistance:     { icon: '💼', accent: '#92400E', badge: 'bg-amber-100 text-amber-800' },
  Transportation: { icon: '🚌', accent: '#0D9488', badge: 'bg-teal-100 text-teal-800' },
  Legal:          { icon: '⚖️', accent: '#9D174D', badge: 'bg-pink-100 text-pink-800' },
  Health:         { icon: '🏥', accent: '#0E7490', badge: 'bg-cyan-100 text-cyan-800' },
  Charity:        { icon: '❤️', accent: '#3730A3', badge: 'bg-indigo-100 text-indigo-800' },
}

export const RESOURCE_TYPES = Object.keys(TYPE_META)

export const HOTLINE_CATEGORIES = [
  'Crisis', 'Emergency', 'Veteran Services', 'Mental Health',
  'Healthcare', 'Legal', 'Senior Services', 'Social Services'
]

export const STATES = ['MO', 'AR']
